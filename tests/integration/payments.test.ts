import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { PaymentRepository } from '../../services/payment-service/src/repositories/payment-repository.js';
import { PaymentService } from '../../services/payment-service/src/services/payment-service.js';
import { WalletRepository } from '../../services/wallet-service/src/repositories/wallet-repository.js';
import { WithdrawalRepository } from '../../services/wallet-service/src/repositories/withdrawal-repository.js';
import { WalletService } from '../../services/wallet-service/src/services/wallet-service.js';
import type {
  IStripeClient,
  CheckoutSessionParams,
  CheckoutSessionResult,
  StripeWebhookEvent,
} from '../../services/payment-service/src/services/stripe-client.js';
import type { DbConnection } from '@agntly/shared';
import pg from 'pg';

// Mock Stripe client — no real API calls
let sessionCounter = 0;

class MockStripeClient implements IStripeClient {
  lastSessionParams: CheckoutSessionParams | null = null;
  shouldFailSignature = false;

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    this.lastSessionParams = params;
    return {
      sessionId: `cs_test_${Date.now()}_${++sessionCounter}`,
      url: 'https://checkout.stripe.com/test',
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    };
  }

  verifyWebhookSignature(signature: string, rawBody: Buffer): StripeWebhookEvent {
    if (this.shouldFailSignature) {
      throw new Error('Invalid webhook signature');
    }
    const body = JSON.parse(rawBody.toString());
    return body as StripeWebhookEvent;
  }
}

// Use valid UUIDs — the DB schema has uuid columns for userId/walletId
const USER_1 = '00000000-0000-0000-0000-000000000001';
const USER_2 = '00000000-0000-0000-0000-000000000002';
const USER_3 = '00000000-0000-0000-0000-000000000003';
const USER_4 = '00000000-0000-0000-0000-000000000004';
const USER_5 = '00000000-0000-0000-0000-000000000005';
const USER_6 = '00000000-0000-0000-0000-000000000006';
const USER_DIFFERENT = '00000000-0000-0000-0000-000000000099';

let db: DbConnection;
let pool: pg.Pool;
let paymentRepo: PaymentRepository;
let walletRepo: WalletRepository;
let walletService: WalletService;

describe('Phase 4: Money In — Stripe Checkout → Wallet Funding', () => {
  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    pool = setup.pool;
    paymentRepo = new PaymentRepository(db);
    walletRepo = new WalletRepository(db);
    const withdrawalRepo = new WithdrawalRepository(db);
    walletService = new WalletService(walletRepo, withdrawalRepo, pool);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  function createPaymentService(mockStripe?: MockStripeClient): {
    service: PaymentService;
    stripe: MockStripeClient;
  } {
    const stripe = mockStripe ?? new MockStripeClient();
    return { service: new PaymentService(paymentRepo, walletRepo, stripe, pool, undefined), stripe };
  }

  function buildWebhookEvent(
    sessionId: string,
    amountCents: number,
    metadata: Record<string, string>,
  ): Buffer {
    return Buffer.from(
      JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            amount_total: amountCents,
            metadata,
            payment_status: 'paid',
          },
        },
      }),
    );
  }

  // Test 1: Create checkout returns URL and pending payment
  it('should create checkout session and record pending payment', async () => {
    const wallet = await walletService.createWallet(USER_1);
    const { service, stripe } = createPaymentService();

    const result = await service.createCheckout(USER_1, wallet.id, 10, 'card');

    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test');
    expect(result.amountUsd).toBe(10);
    expect(result.method).toBe('card');
    expect(stripe.lastSessionParams?.amountCents).toBe(1000);
    expect(stripe.lastSessionParams?.metadata.walletId).toBe(wallet.id);

    // Verify pending payment was recorded in DB
    const history = await paymentRepo.findByUserId(USER_1, 10, 0);
    expect(history.rows.length).toBe(1);
    expect(history.rows[0]!.status).toBe('pending');
  });

  // Test 2: Checkout for wallet not owned by user throws
  it('should reject checkout for wallet not owned by user', async () => {
    const wallet = await walletService.createWallet(USER_1);
    const { service } = createPaymentService();

    await expect(
      service.createCheckout(USER_DIFFERENT, wallet.id, 10, 'card'),
    ).rejects.toThrow('does not belong');
  });

  // Test 3: Valid webhook credits wallet and marks payment completed
  it('should credit wallet on valid webhook', async () => {
    const wallet = await walletService.createWallet(USER_2);
    const { service } = createPaymentService();

    // Create checkout first (records pending payment with stripe_session_id)
    const checkout = await service.createCheckout(USER_2, wallet.id, 25, 'card');

    // Find the payment to get the stripe session ID
    const paymentHistory = await paymentRepo.findByUserId(USER_2, 1, 0);
    const stripeSessionId = paymentHistory.rows[0]?.stripeSessionId;
    expect(stripeSessionId).toBeTruthy();

    // Simulate webhook
    const webhookBody = buildWebhookEvent(stripeSessionId!, 2500, {
      walletId: wallet.id,
      userId: USER_2,
      paymentId: checkout.paymentId,
    });

    await service.handleWebhook('valid-sig', webhookBody);

    // Verify wallet was credited ($25 = 2500 cents / 100)
    const funded = await walletRepo.findById(wallet.id);
    expect(parseFloat(funded!.balance)).toBe(25);

    // Verify payment is marked completed
    const completedPayment = await paymentRepo.findByStripeSessionId(stripeSessionId!);
    expect(completedPayment!.status).toBe('completed');
    expect(completedPayment!.usdcAmount).toBeTruthy();
  });

  // Test 4: Duplicate webhook — no double credit
  it('should not double-credit on duplicate webhook', async () => {
    const wallet = await walletService.createWallet(USER_3);
    const { service } = createPaymentService();

    await service.createCheckout(USER_3, wallet.id, 50, 'card');
    const paymentHistory = await paymentRepo.findByUserId(USER_3, 1, 0);
    const stripeSessionId = paymentHistory.rows[0]!.stripeSessionId!;

    const webhookBody = buildWebhookEvent(stripeSessionId, 5000, {
      walletId: wallet.id,
      userId: USER_3,
      paymentId: 'pay_test',
    });

    // Process the same webhook twice
    await service.handleWebhook('valid-sig', webhookBody);
    await service.handleWebhook('valid-sig', webhookBody);

    // Wallet should only be credited once ($50)
    const funded = await walletRepo.findById(wallet.id);
    expect(parseFloat(funded!.balance)).toBe(50);
  });

  // Test 5: 10 concurrent webhooks — wallet credited exactly once
  it('should credit exactly once under 10 concurrent webhook deliveries', async () => {
    const wallet = await walletService.createWallet(USER_4);
    const { service } = createPaymentService();

    await service.createCheckout(USER_4, wallet.id, 100, 'card');
    const paymentHistory = await paymentRepo.findByUserId(USER_4, 1, 0);
    const stripeSessionId = paymentHistory.rows[0]!.stripeSessionId!;

    const webhookBody = buildWebhookEvent(stripeSessionId, 10000, {
      walletId: wallet.id,
      userId: USER_4,
      paymentId: 'pay_test',
    });

    // Fire 10 concurrent webhooks
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.handleWebhook('valid-sig', webhookBody)),
    );

    // All should resolve without error — duplicates are idempotent no-ops
    const errors = results.filter((r) => r.status === 'rejected');
    expect(errors.length).toBe(0);

    // Wallet must be credited exactly once ($100)
    const funded = await walletRepo.findById(wallet.id);
    expect(parseFloat(funded!.balance)).toBe(100);
  });

  // Test 6: Invalid signature throws
  it('should reject webhook with invalid signature', async () => {
    const mockStripe = new MockStripeClient();
    mockStripe.shouldFailSignature = true;
    const { service } = createPaymentService(mockStripe);

    const webhookBody = Buffer.from('{}');

    await expect(service.handleWebhook('bad-sig', webhookBody)).rejects.toThrow('signature');
  });

  // Test 7: Webhook for non-existent wallet → payment marked failed
  it('should mark payment failed when wallet does not exist in webhook', async () => {
    const wallet = await walletService.createWallet(USER_5);
    const { service } = createPaymentService();

    await service.createCheckout(USER_5, wallet.id, 10, 'card');
    const paymentHistory = await paymentRepo.findByUserId(USER_5, 1, 0);
    const stripeSessionId = paymentHistory.rows[0]!.stripeSessionId!;

    // Build webhook with a non-existent wallet ID in metadata
    const webhookBody = buildWebhookEvent(stripeSessionId, 1000, {
      walletId: '00000000-0000-0000-0000-000000000099',
      userId: USER_5,
      paymentId: 'pay_test',
    });

    await service.handleWebhook('valid-sig', webhookBody);

    // Payment should be marked failed with wallet_not_found reason
    const failedPayment = await paymentRepo.findByStripeSessionId(stripeSessionId);
    expect(failedPayment!.status).toBe('failed');
    expect(failedPayment!.failureReason).toBe('wallet_not_found');
  });

  // Test 8: Payment history pagination
  it('should return paginated payment history', async () => {
    const wallet = await walletService.createWallet(USER_6);
    const { service } = createPaymentService();

    // Create 3 checkouts
    await service.createCheckout(USER_6, wallet.id, 10, 'card');
    await service.createCheckout(USER_6, wallet.id, 20, 'ach');
    await service.createCheckout(USER_6, wallet.id, 30, 'card');

    // Page 1: limit=2, offset=0
    const page1 = await service.getPaymentHistory(USER_6, 2, 0);
    expect(page1.payments.length).toBe(2);
    expect(page1.total).toBe(3);
    expect(page1.limit).toBe(2);
    expect(page1.offset).toBe(0);

    // Page 2: limit=2, offset=2
    const page2 = await service.getPaymentHistory(USER_6, 2, 2);
    expect(page2.payments.length).toBe(1);
    expect(page2.total).toBe(3);
  });
});
