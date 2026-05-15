const APP_DIR = '/opt/agntly/sandbox';
const ENV_FILE = `${APP_DIR}/.env`;

const sharedEnv = {
  NODE_ENV: 'development',
  APP_DIR,

  // Sandbox port range: 4000-4100
  GATEWAY_PORT: '4000',
  AUTH_PORT: '4001',
  WALLET_PORT: '4002',
  ESCROW_PORT: '4003',
  TASK_PORT: '4004',
  REGISTRY_PORT: '4005',
  PAYMENT_PORT: '4006',
  WEBHOOK_PORT: '4007',
  SETTLEMENT_PORT: '4008',

  // Service URLs for inter-service calls
  AUTH_SERVICE_URL: 'http://localhost:4001',
  WALLET_SERVICE_URL: 'http://localhost:4002',
  ESCROW_SERVICE_URL: 'http://localhost:4003',
  TASK_SERVICE_URL: 'http://localhost:4004',
  REGISTRY_SERVICE_URL: 'http://localhost:4005',
  PAYMENT_SERVICE_URL: 'http://localhost:4006',
  WEBHOOK_SERVICE_URL: 'http://localhost:4007',

  FRONTEND_URL: 'https://sandbox.agntly.io',
  NEXT_PUBLIC_APP_URL: 'https://sandbox.agntly.io',
  NEXT_PUBLIC_APP_ENV: 'sandbox',
};

const services = [
  { name: 'sb-auth',       script: 'services/auth-service/src/server.ts' },
  { name: 'sb-wallet',     script: 'services/wallet-service/src/server.ts' },
  { name: 'sb-escrow',     script: 'services/escrow-engine/src/server.ts' },
  { name: 'sb-task',       script: 'services/task-service/src/server.ts' },
  { name: 'sb-registry',   script: 'services/registry-service/src/server.ts' },
  { name: 'sb-payment',    script: 'services/payment-service/src/server.ts' },
  { name: 'sb-webhook',    script: 'services/webhook-service/src/server.ts' },
  { name: 'sb-settlement', script: 'services/settlement-worker/src/server.ts' },
  { name: 'sb-gateway',    script: 'services/api-gateway/src/server.ts' },
];

module.exports = {
  apps: [
    ...services.map(({ name, script }) => ({
      name,
      script: 'npx',
      args: `tsx ${script}`,
      cwd: APP_DIR,
      env_file: ENV_FILE,
      env: sharedEnv,
      interpreter: 'none',
      restart_delay: 3000,
      max_restarts: 10,
    })),
    {
      name: 'sb-frontend',
      script: 'npx',
      args: 'next start -p 4100',
      cwd: `${APP_DIR}/frontend`,
      env_file: ENV_FILE,
      env: {
        ...sharedEnv,
        PORT: '4100',
      },
      interpreter: 'none',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
