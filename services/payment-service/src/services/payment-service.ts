import { generateId } from '@agntly/shared';
import type { EventBus } from '@agntly/shared';
import type { PaymentRepository } from '../repositories/payment-repository.js';
import type { IStripeClient } from './stripe-client.js';
import type { WalletRepository } from '@agntly/wallet-service/repositories/wallet-repository';
import pg from 'pg';

export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly walletRepo: WalletRepository,
    private readonly stripeClient: IStripeClient,
    private readonly pool: pg.Pool,
    private readonly eventBus?: EventBus,
  ) {}

  async createCheckout(
    userId: string,
    walletId: string,
    amountUsd: number,
    method: 'card' | 'ach',
  ): Promise<{
    readonly paymentId: string;
    readonly checkoutUrl: string;
    readonly amountUsd: number;
    readonly method: string;
    readonly expiresAt: string;
  }> {
    // Verify wallet exists and belongs to user
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.ownerId !== userId) throw new Error('Wallet does not belong to user');

    const paymentId = generateId('pay');
    const amountCents = Math.round(amountUsd * 100);

    // Create Stripe Checkout Session
    const session = await this.stripeClient.createCheckoutSession({
      amountCents,
      method,
      metadata: { walletId, userId, paymentId },
    });

    // Record pending payment
    await this.paymentRepo.create({
      userId,
      walletId,
      amountUsd: amountUsd.toFixed(2),
      method,
      stripeSessionId: session.sessionId,
    });

    return {
      paymentId,
      checkoutUrl: session.url,
      amountUsd,
      method,
      expiresAt: new Date(session.expiresAt * 1000).toISOString(),
    };
  }

  async handleWebhook(signature: string, rawBody: Buffer): Promise<void> {
    // Verify Stripe signature (throws on invalid)
    const event = this.stripeClient.verifyWebhookSignature(signature, rawBody);

    // Only handle checkout.session.completed — ignore others silently
    if (event.type !== 'checkout.session.completed') return;

    const session = event.data.object;
    const stripeSessionId = session.id;
    const walletId = session.metadata?.walletId;
    if (!walletId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(walletId)) {
      console.error('Invalid walletId in Stripe session metadata:', walletId);
      return; // Skip — don't credit an invalid wallet
    }
    // Use integer arithmetic to avoid floating-point precision errors
    const cents = session.amount_total;
    const dollars = Math.floor(cents / 100);
    const remainingCents = cents % 100;
    const usdcAmount = `${dollars}.${String(remainingCents).padStart(2, '0')}0000`;

    // CRITICAL TRANSACTION: both payment + wallet updates on the same pg client
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Atomic CAS: only the first processor wins (idempotency guard)
      const paymentResult = await client.query<{ id: string; wallet_id: string }>(
        `UPDATE payments
         SET status = 'completed', usdc_amount = $2::numeric, completed_at = NOW()
         WHERE stripe_session_id = $1 AND status = 'pending'
         RETURNING id, wallet_id`,
        [stripeSessionId, usdcAmount],
      );

      if (paymentResult.rows.length === 0) {
        // Already processed (duplicate webhook) — idempotent no-op
        await client.query('ROLLBACK');
        return;
      }

      const paymentId = paymentResult.rows[0]!.id;

      // Credit the wallet within the same transaction
      const creditResult = await client.query<{ id: string }>(
        `UPDATE wallets
         SET balance = balance + $2::numeric, updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING id`,
        [walletId, usdcAmount],
      );

      if (creditResult.rows.length === 0) {
        // Wallet not found — rollback payment completion
        await client.query('ROLLBACK');
        // Mark payment failed outside transaction (uses Drizzle pool — fine)
        await this.paymentRepo.markFailed(paymentId, 'wallet_not_found');
        return;
      }

      await client.query('COMMIT');

      // Publish event after commit — best-effort, non-critical
      if (this.eventBus) {
        try {
          await this.eventBus.publish('wallet.funded', {
            paymentId,
            walletId,
            userId: session.metadata.userId,
            usdcAmount,
            method: session.metadata.method ?? 'card',
            stripeSessionId,
          });
        } catch (publishErr) {
          // Log but do not rethrow — event publish is best-effort
          console.error('[payment-service] Failed to publish wallet.funded event:', publishErr);
        }
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getPaymentHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    readonly payments: readonly unknown[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  }> {
    const { rows, total } = await this.paymentRepo.findByUserId(userId, limit, offset);
    return { payments: rows, total, limit, offset };
  }
}
