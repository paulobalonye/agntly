import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const SUCCESS_URL = process.env.STRIPE_SUCCESS_URL ?? 'http://localhost:3000/wallet?funded=true';
const CANCEL_URL = process.env.STRIPE_CANCEL_URL ?? 'http://localhost:3000/wallet?canceled=true';

export interface CheckoutSessionParams {
  readonly amountCents: number;
  readonly method: 'card' | 'ach';
  readonly metadata: {
    readonly walletId: string;
    readonly userId: string;
    readonly paymentId: string;
  };
}

export interface CheckoutSessionResult {
  readonly sessionId: string;
  readonly url: string;
  readonly expiresAt: number;
}

export interface StripeWebhookEvent {
  readonly type: string;
  readonly data: {
    readonly object: {
      readonly id: string;
      readonly amount_total: number;
      readonly metadata: Record<string, string>;
      readonly payment_status: string;
    };
  };
}

/**
 * Interface for Stripe operations — injectable for testing.
 */
export interface IStripeClient {
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;
  verifyWebhookSignature(signature: string, rawBody: Buffer): StripeWebhookEvent;
}

export class StripeClient implements IStripeClient {
  private readonly stripe: Stripe;

  constructor(secretKey?: string) {
    this.stripe = new Stripe(secretKey ?? STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as any,
    });
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      params.method === 'ach' ? ['us_bank_account'] : ['card'];

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: params.amountCents,
            product_data: {
              name: 'Agntly Wallet Funding',
              description: `Fund wallet with $${(params.amountCents / 100).toFixed(2)} USD`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        walletId: params.metadata.walletId,
        userId: params.metadata.userId,
        paymentId: params.metadata.paymentId,
      },
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
    });

    return {
      sessionId: session.id,
      url: session.url ?? '',
      expiresAt: session.expires_at,
    };
  }

  verifyWebhookSignature(signature: string, rawBody: Buffer): StripeWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
    return event as unknown as StripeWebhookEvent;
  }
}
