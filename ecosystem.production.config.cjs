const APP_DIR = '/opt/agntly/production';
const ENV_FILE = `${APP_DIR}/.env`;

const sharedEnv = {
  NODE_ENV: 'production',
  APP_DIR,

  // Production port range: 3000-3100 (defaults, no override needed)
  FRONTEND_URL: 'https://agntly.io',
  NEXT_PUBLIC_APP_URL: 'https://agntly.io',
  NEXT_PUBLIC_APP_ENV: 'production',

  // Service URLs for inter-service calls
  AUTH_SERVICE_URL: 'http://localhost:3001',
  WALLET_SERVICE_URL: 'http://localhost:3002',
  ESCROW_SERVICE_URL: 'http://localhost:3003',
  TASK_SERVICE_URL: 'http://localhost:3004',
  REGISTRY_SERVICE_URL: 'http://localhost:3005',
  PAYMENT_SERVICE_URL: 'http://localhost:3006',
  WEBHOOK_SERVICE_URL: 'http://localhost:3007',
};

const services = [
  { name: 'prod-auth',       script: 'services/auth-service/src/server.ts' },
  { name: 'prod-wallet',     script: 'services/wallet-service/src/server.ts' },
  { name: 'prod-escrow',     script: 'services/escrow-engine/src/server.ts' },
  { name: 'prod-task',       script: 'services/task-service/src/server.ts' },
  { name: 'prod-registry',   script: 'services/registry-service/src/server.ts' },
  { name: 'prod-payment',    script: 'services/payment-service/src/server.ts' },
  { name: 'prod-webhook',    script: 'services/webhook-service/src/server.ts' },
  { name: 'prod-settlement', script: 'services/settlement-worker/src/server.ts' },
  { name: 'prod-gateway',    script: 'services/api-gateway/src/server.ts' },
];

module.exports = {
  apps: [
    ...services.map(({ name, script }) => ({
      name,
      script: '/bin/bash',
      args: `-c 'set -a && source ${ENV_FILE} && set +a && exec tsx ${script}'`,
      cwd: APP_DIR,
      env: sharedEnv,
      interpreter: 'none',
      restart_delay: 3000,
      max_restarts: 10,
    })),
    {
      name: 'prod-frontend',
      script: '/bin/bash',
      args: `-c 'set -a && source ${ENV_FILE} && set +a && exec next start -p 3100'`,
      cwd: `${APP_DIR}/frontend`,
      env: {
        ...sharedEnv,
        PORT: '3100',
      },
      interpreter: 'none',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
