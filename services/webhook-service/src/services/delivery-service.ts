import { createHmac } from 'node:crypto';
import type { WebhookRepository, WebhookSubscriptionRow } from '../repositories/webhook-repository.js';

function isPublicUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const hostname = url.hostname;
    // Block private/internal IPs
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('10.')) return false;
    if (hostname.startsWith('172.') && parseInt(hostname.split('.')[1] ?? '0') >= 16 && parseInt(hostname.split('.')[1] ?? '0') <= 31) return false;
    if (hostname.startsWith('192.168.')) return false;
    if (hostname === '169.254.169.254') return false; // AWS metadata
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

const BACKOFF_SECONDS = [60, 300, 1500, 7200, 43200] as const;
const MAX_ATTEMPTS = 5;
const FETCH_TIMEOUT_MS = 10_000;

export interface DeliveryEvent {
  readonly id: string;
  readonly type: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: string;
}

export class DeliveryService {
  constructor(private readonly webhookRepo: WebhookRepository) {}

  signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  calculateNextRetry(attempts: number): Date {
    const index = Math.min(attempts, BACKOFF_SECONDS.length - 1);
    const delaySeconds = BACKOFF_SECONDS[index]!;
    return new Date(Date.now() + delaySeconds * 1000);
  }

  async deliver(subscription: WebhookSubscriptionRow, event: DeliveryEvent): Promise<void> {
    if (!isPublicUrl(subscription.url)) {
      const delivery = await this.webhookRepo.createDelivery({
        subscriptionId: subscription.id,
        eventType: event.type,
        eventId: event.id,
        payload: JSON.stringify({ id: event.id, type: event.type, data: event.data, timestamp: event.timestamp }),
        signature: '',
      });
      await this.webhookRepo.markFailed(delivery.id, null, 'SSRF_BLOCKED');
      return;
    }

    const payload = JSON.stringify({
      id: event.id,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
    });

    // Note: secretHash is misleadingly named — it stores the raw secret, not a hash.
    // This is correct for HMAC signing (requires the raw secret).
    // Fall back to AGNTLY_WEBHOOK_SECRET if subscription has no per-subscription secret.
    const signingSecret = subscription.secretHash || process.env.AGNTLY_WEBHOOK_SECRET || '';
    const signature = this.signPayload(payload, signingSecret);

    const delivery = await this.webhookRepo.createDelivery({
      subscriptionId: subscription.id,
      eventType: event.type,
      eventId: event.id,
      payload,
      signature,
    });

    await this._attemptDelivery(delivery.id, subscription.url, payload, signature, event.type, delivery.attempts);
  }

  async processRetries(): Promise<void> {
    const pending = await this.webhookRepo.findPendingRetries();

    for (const delivery of pending) {
      const subscription = await this.webhookRepo.findSubscriptionById(delivery.subscriptionId);
      if (!subscription) {
        await this.webhookRepo.markFailed(delivery.id, null, 'Subscription not found');
        continue;
      }

      if (!isPublicUrl(subscription.url)) {
        await this.webhookRepo.markFailed(delivery.id, null, 'SSRF_BLOCKED');
        continue;
      }

      await this._attemptDelivery(
        delivery.id,
        subscription.url,
        delivery.payload,
        delivery.signature,
        delivery.eventType,
        delivery.attempts,
      );
    }
  }

  private async _attemptDelivery(
    deliveryId: string,
    url: string,
    payload: string,
    signature: string,
    eventType: string,
    currentAttempts: number,
  ): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let statusCode: number | null = null;
    let responseBody = '';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agntly-Signature': `sha256=${signature}`,
          'X-Agntly-Event': eventType,
          'X-Agntly-Delivery': deliveryId,
        },
        body: payload,
        signal: controller.signal,
      });

      statusCode = response.status;
      responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await this.webhookRepo.markDelivered(deliveryId, statusCode, responseBody);
        return;
      }

      // Non-2xx response
      await this._handleFailure(deliveryId, statusCode, responseBody, currentAttempts);
    } catch (err) {
      responseBody = err instanceof Error ? err.message : String(err);
      await this._handleFailure(deliveryId, statusCode, responseBody, currentAttempts);
    } finally {
      clearTimeout(timer);
    }
  }

  private async _handleFailure(
    deliveryId: string,
    statusCode: number | null,
    responseBody: string,
    currentAttempts: number,
  ): Promise<void> {
    if (currentAttempts >= MAX_ATTEMPTS - 1) {
      await this.webhookRepo.markFailed(deliveryId, statusCode, responseBody);
    } else {
      const nextRetryAt = this.calculateNextRetry(currentAttempts);
      await this.webhookRepo.markRetry(deliveryId, statusCode, responseBody, nextRetryAt);
    }
  }
}
