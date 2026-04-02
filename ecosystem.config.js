module.exports = {
  apps: [
    { name: 'auth-service', script: './start-services.sh', args: 'services/auth-service/src/server.ts', cwd: '/home/agntly/agntly' },
    { name: 'wallet-service', script: './start-services.sh', args: 'services/wallet-service/src/server.ts', cwd: '/home/agntly/agntly' },
    { name: 'escrow-engine', script: './start-services.sh', args: 'services/escrow-engine/src/server.ts', cwd: '/home/agntly/agntly' },
    { name: 'task-service', script: './start-services.sh', args: 'services/task-service/src/server.ts', cwd: '/home/agntly/agntly' },
    { name: 'registry-service', script: './start-services.sh', args: 'services/registry-service/src/server.ts', cwd: '/home/agntly/agntly' },
    { name: 'payment-service', script: './start-services.sh', args: 'services/payment-service/src/server.ts', cwd: '/home/agntly/agntly' },
    { name: 'webhook-service', script: './start-services.sh', args: 'services/webhook-service/src/server.ts', cwd: '/home/agntly/agntly' },
    { name: 'settlement-worker', script: './start-services.sh', args: 'services/settlement-worker/src/server.ts', cwd: '/home/agntly/agntly' },
    { name: 'api-gateway', script: './start-services.sh', args: 'services/api-gateway/src/server.ts', cwd: '/home/agntly/agntly' },
    {
      name: 'frontend',
      script: '/bin/sh',
      args: '-c "cd /home/agntly/agntly/frontend && node_modules/.bin/next start -p 3100"',
      interpreter: 'none',
      cwd: '/home/agntly/agntly/frontend',
    },
  ],
};
