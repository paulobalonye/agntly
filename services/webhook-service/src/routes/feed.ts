import type { FastifyPluginAsync } from 'fastify';

interface SSEClient {
  id: string;
  reply: any;
}

const clients: SSEClient[] = [];
let clientIdCounter = 0;

export function broadcastEvent(event: { type: string; data: Record<string, unknown>; timestamp: string }): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (let i = clients.length - 1; i >= 0; i--) {
    try {
      clients[i]!.reply.raw.write(payload);
    } catch {
      clients.splice(i, 1); // Remove dead client
    }
  }
}

export const feedRoutes: FastifyPluginAsync = async (app) => {
  app.get('/feed', async (request, reply) => {
    const clientId = `sse_${++clientIdCounter}`;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection event
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    clients.push({ id: clientId, reply });

    // Remove client on disconnect
    request.raw.on('close', () => {
      const idx = clients.findIndex((c) => c.id === clientId);
      if (idx !== -1) clients.splice(idx, 1);
    });

    // Keep connection open — do NOT call reply.send()
  });
};
