import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.post('/run', async (request, reply) => {
  const body = request.body as { taskId?: string; payload?: Record<string, unknown> };

  return reply.status(200).send({
    success: true,
    result: {
      echo: body.payload ?? {},
      message: 'Task processed by Echo Agent',
      processedAt: new Date().toISOString(),
      taskId: body.taskId ?? 'unknown',
    },
  });
});

app.get('/health', async () => ({ status: 'ok', agent: 'echo-agent' }));

const port = 4000;
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`Echo agent running on port ${port}`);
});
