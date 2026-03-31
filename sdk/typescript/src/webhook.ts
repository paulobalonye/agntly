import { createHmac, timingSafeEqual } from 'node:crypto';
import { AgntlyError } from './errors.js';

/**
 * Verify an incoming Agntly webhook request.
 *
 * Agntly signs every webhook delivery with HMAC-SHA256 and sends the
 * signature in the `X-Agntly-Signature` header as `sha256=<hex>`.
 *
 * Usage:
 * ```ts
 * import { verifyWebhook } from '@agntly/sdk';
 *
 * app.post('/webhook', (req, res) => {
 *   const event = verifyWebhook(
 *     req.rawBody,                            // raw request body (Buffer or string)
 *     req.headers['x-agntly-signature'],      // signature header
 *     process.env.AGNTLY_WEBHOOK_SECRET,      // your webhook secret
 *   );
 *   // event is the parsed, verified payload
 * });
 * ```
 *
 * @param payload   Raw request body — must be the original bytes, not parsed JSON
 * @param signature Value of the `X-Agntly-Signature` header
 * @param secret    Your `AGNTLY_WEBHOOK_SECRET`
 * @returns         Parsed webhook event
 * @throws          AgntlyError if signature is missing, malformed, or does not match
 */
export function verifyWebhook(
  payload: string | Buffer,
  signature: string | string[] | undefined,
  secret: string,
): WebhookEvent {
  if (!signature) {
    throw new AgntlyError('Missing X-Agntly-Signature header', 400);
  }

  const sigHeader = Array.isArray(signature) ? signature[0] : signature;
  if (!sigHeader || !sigHeader.startsWith('sha256=')) {
    throw new AgntlyError('Invalid X-Agntly-Signature format — expected sha256=<hex>', 400);
  }

  const receivedHex = sigHeader.slice('sha256='.length);
  const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
  const expectedHex = createHmac('sha256', secret).update(payloadStr).digest('hex');

  const received = Buffer.from(receivedHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new AgntlyError('Webhook signature verification failed', 400);
  }

  try {
    return JSON.parse(payloadStr) as WebhookEvent;
  } catch {
    throw new AgntlyError('Webhook payload is not valid JSON', 400);
  }
}

export interface WebhookEvent {
  readonly id: string;
  readonly type: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: string;
}
