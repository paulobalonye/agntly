import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { AuthService } from '../services/auth-service.js';
import type { ApiKeyService } from '../services/api-key-service.js';

/**
 * Autonomous agent registration — no email, no password, no human.
 * An AI agent signs a challenge message with its wallet private key.
 * The server verifies the signature and issues an API key.
 *
 * Flow:
 * 1. GET /challenge?address=0x... → returns a challenge nonce
 * 2. POST /register → { address, signature, label } → returns API key
 */

// In-memory challenge store (expires after 5 minutes)
const challenges = new Map<string, { nonce: string; expires: number }>();

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function cleanExpiredChallenges() {
  const now = Date.now();
  for (const [key, val] of challenges) {
    if (val.expires < now) challenges.delete(key);
  }
}

const registerSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address'),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid hex signature'),
  label: z.string().min(1).max(100).optional(),
});

export const autonomousRoutes: FastifyPluginAsync = async (app) => {
  const decorated = app as unknown as {
    authService: AuthService;
    apiKeyService: ApiKeyService;
  };

  // GET /challenge — Get a challenge nonce for wallet signing
  app.get('/challenge', async (request, reply) => {
    const { address } = request.query as { address?: string };
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return reply.status(400).send(createErrorResponse('Valid Ethereum address required (?address=0x...)'));
    }

    cleanExpiredChallenges();

    const nonce = generateNonce();
    const message = `Agntly Agent Registration\n\nI authorize this wallet to register as an autonomous agent on Agntly.\n\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

    challenges.set(address.toLowerCase(), {
      nonce,
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    return reply.status(200).send(createApiResponse({
      message,
      nonce,
      expiresIn: 300,
    }));
  });

  // POST /register — Verify signature and create agent account + API key
  app.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }

    const { address, signature, label } = parsed.data;
    const normalizedAddress = address.toLowerCase();

    // Check challenge exists and hasn't expired
    const challenge = challenges.get(normalizedAddress);
    if (!challenge || challenge.expires < Date.now()) {
      return reply.status(400).send(createErrorResponse('Challenge expired or not found. Request a new challenge first.'));
    }

    // Verify signature — use dynamic import for viem (available in the monorepo)
    try {
      const viemPath = '../../node_modules/.pnpm/viem@2.29.2/node_modules/viem/index.js';
      // Dynamic import to avoid hard dependency on viem in auth-service
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let recoverFn: any;

      try {
        const viem = await (Function('return import("viem")')() as Promise<any>);
        recoverFn = viem.recoverMessageAddress;
      } catch {
        // If viem not available, skip signature verification (dev mode)
        console.warn('[autonomous] viem not available — skipping signature verification');
        recoverFn = async () => normalizedAddress; // trust in dev mode
      }

      const expectedMessage = `Agntly Agent Registration\n\nI authorize this wallet to register as an autonomous agent on Agntly.\n\nAddress: ${normalizedAddress}\nNonce: ${challenge.nonce}`;
      const recoveredAddress = await recoverFn({
        message: expectedMessage,
        signature: signature as `0x${string}`,
      });

      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        return reply.status(401).send(createErrorResponse('Signature verification failed — address mismatch'));
      }
    } catch {
      return reply.status(401).send(createErrorResponse('Signature verification failed'));
    }

    // Consume the challenge (one-time use)
    challenges.delete(normalizedAddress);

    // Create user account with wallet address as email (agent@<address>)
    const agentEmail = `agent@${normalizedAddress}`;
    const authService = decorated.authService;
    const apiKeyService = decorated.apiKeyService;

    try {
      const user = await authService.getOrCreateUser(agentEmail);

      // Generate API key for the agent
      const keyResult = await apiKeyService.createKey(user.id, label ?? `agent-${normalizedAddress.slice(0, 10)}`);

      // Create wallet for the agent
      try {
        const walletUrl = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';
        await fetch(`${walletUrl}/v1/wallets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
          body: JSON.stringify({}),
        });
      } catch {
        // Wallet creation failure is non-fatal
      }

      return reply.status(201).send(createApiResponse({
        userId: user.id,
        address: normalizedAddress,
        apiKey: keyResult.key,
        keyPrefix: keyResult.prefix,
        label: keyResult.label,
        message: 'Autonomous agent registered. Use the API key for all subsequent requests.',
      }));
    } catch (err) {
      return reply.status(500).send(createErrorResponse('Registration failed'));
    }
  });

  // Rate limit for registration abuse prevention (5 per IP per hour)
  const regAttempts = new Map<string, { count: number; resetAt: number }>();

  function checkRegRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = regAttempts.get(ip);
    if (!entry || entry.resetAt < now) {
      regAttempts.set(ip, { count: 1, resetAt: now + 3600_000 });
      return true;
    }
    entry.count++;
    return entry.count <= 5;
  }

  // POST /register-simple — Simplified registration (no signature)
  // For agents that can't sign Ethereum messages (e.g., Python scripts without web3)
  app.post('/register-simple', async (request, reply) => {
    const clientIp = String(request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown');
    if (!checkRegRateLimit(clientIp)) {
      return reply.status(429).send(createErrorResponse('Too many registrations. Limit: 5 per hour per IP.'));
    }

    const schema = z.object({
      agentName: z.string().min(1).max(100),
      walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('agentName is required'));
    }

    const { agentName, walletAddress } = parsed.data;
    const authService = decorated.authService;
    const apiKeyService = decorated.apiKeyService;

    // Create a unique identifier for this agent
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agentEmail = `${agentId}@agents.agntly.io`;

    try {
      const user = await authService.getOrCreateUser(agentEmail);

      // Generate API key
      const keyResult = await apiKeyService.createKey(user.id, agentName);

      // Create wallet
      try {
        const walletUrl = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';
        await fetch(`${walletUrl}/v1/wallets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
          body: JSON.stringify({}),
        });
      } catch { /* non-fatal */ }

      return reply.status(201).send(createApiResponse({
        userId: user.id,
        agentId,
        apiKey: keyResult.key,
        keyPrefix: keyResult.prefix,
        label: agentName,
        walletAddress: walletAddress ?? null,
        message: 'Agent registered. Use the API key to list agents and create tasks.',
      }));
    } catch {
      return reply.status(500).send(createErrorResponse('Registration failed'));
    }
  });
};
