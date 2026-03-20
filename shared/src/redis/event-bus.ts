import IORedis from 'ioredis';
import type { WebhookEvent } from '../types/index.js';

export interface ServiceMessage {
  readonly id: string;
  readonly type: WebhookEvent;
  readonly source: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: string;
}

const STREAM_KEY = 'agntly:events';
const CONSUMER_GROUP = 'agntly-services';

export class EventBus {
  private publisher: any;
  private subscriber: any = null;
  private readonly serviceName: string;

  constructor(serviceName: string, redisUrl?: string) {
    const url = redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
    if (!url.includes('@') && process.env.NODE_ENV === 'production') {
      console.warn('WARNING: Redis connection has no authentication — not recommended for production');
    }
    this.publisher = new (IORedis as any)(url);
    this.serviceName = serviceName;
  }

  async publish(type: WebhookEvent, data: Record<string, unknown>): Promise<string> {
    const message: ServiceMessage = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      type,
      source: this.serviceName,
      data,
      timestamp: new Date().toISOString(),
    };

    const id = await this.publisher.xadd(
      STREAM_KEY, '*',
      'id', message.id,
      'type', message.type,
      'source', message.source,
      'data', JSON.stringify(message.data),
      'timestamp', message.timestamp,
    );

    return id ?? message.id;
  }

  async subscribe(
    handler: (message: ServiceMessage) => Promise<void>,
    events?: readonly WebhookEvent[],
  ): Promise<void> {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.subscriber = new (IORedis as any)(url);

    try {
      await this.subscriber.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM');
    } catch {
      // Group already exists
    }

    const consumerName = `${this.serviceName}-${process.pid}`;

    const poll = async () => {
      if (!this.subscriber) return;
      try {
        const results = await this.subscriber.xreadgroup(
          'GROUP', CONSUMER_GROUP, consumerName,
          'COUNT', '10', 'BLOCK', '5000',
          'STREAMS', STREAM_KEY, '>',
        );

        if (results) {
          for (const [, messages] of results) {
            for (const [streamId, fields] of messages as any[]) {
              const parsed = parseFields(fields);
              if (!parsed) continue;
              if (events && !events.includes(parsed.type)) {
                await this.subscriber.xack(STREAM_KEY, CONSUMER_GROUP, streamId);
                continue;
              }
              try {
                await handler(parsed);
                await this.subscriber.xack(STREAM_KEY, CONSUMER_GROUP, streamId);
              } catch (err) {
                console.error(`[${this.serviceName}] Error handling event ${parsed.id}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[${this.serviceName}] Redis stream error:`, err);
      }
      if (this.subscriber) setImmediate(poll);
    };

    poll();
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}

function parseFields(fields: string[]): ServiceMessage | null {
  const map = new Map<string, string>();
  for (let i = 0; i < fields.length; i += 2) {
    map.set(fields[i]!, fields[i + 1]!);
  }
  const id = map.get('id');
  const type = map.get('type') as WebhookEvent | undefined;
  const source = map.get('source');
  const dataStr = map.get('data');
  const timestamp = map.get('timestamp');
  if (!id || !type || !source || !dataStr || !timestamp) return null;
  try {
    return { id, type, source, data: JSON.parse(dataStr), timestamp };
  } catch {
    return null;
  }
}
