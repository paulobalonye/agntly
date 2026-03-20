import { createServer } from 'node:http';

const PORT = 4000;

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', agent: 'echo-agent' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/run') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(body); } catch { /* ignore */ }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: {
          echo: parsed.payload ?? {},
          message: 'Task processed by Echo Agent',
          processedAt: new Date().toISOString(),
          taskId: parsed.taskId ?? 'unknown',
        },
      }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Echo agent running on port ${PORT}`);
});
