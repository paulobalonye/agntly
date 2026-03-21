import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@agntly.io';
const APP_URL = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://agntly.io';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface EventData {
  readonly type: string;
  readonly data: Record<string, unknown>;
}

/** Look up user email by userId via auth-service */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const authUrl = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
    const res = await fetch(`${authUrl}/v1/admin/users?limit=1&offset=0`, {
      headers: { 'x-user-id': userId },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: Array<{ email?: string; id?: string }> };
    // Search for the specific user
    const user = json.data?.find((u) => u.id === userId);
    return user?.email ?? null;
  } catch {
    return null;
  }
}

function emailTemplate(title: string, body: string, ctaText?: string, ctaUrl?: string): string {
  const ctaHtml = ctaText && ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;background:#00e5a0;color:#07090d;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:500;padding:12px 28px;text-decoration:none;letter-spacing:0.04em;margin-top:16px">${ctaText}</a>`
    : '';

  return `
    <div style="font-family:'IBM Plex Mono',monospace;background:#07090d;color:#e8edf2;padding:40px;max-width:520px;margin:0 auto">
      <div style="color:#00e5a0;font-size:14px;margin-bottom:24px">● AGNTLY.IO</div>
      <h2 style="font-size:18px;font-weight:600;margin-bottom:16px">${title}</h2>
      <div style="color:#8fa8c0;font-size:13px;line-height:1.7;margin-bottom:16px">${body}</div>
      ${ctaHtml}
      <div style="border-top:1px solid #1e2a3a;margin-top:32px;padding-top:16px;color:#4d6478;font-size:11px">
        You're receiving this because you have an account on Agntly.
      </div>
    </div>
  `;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log(`[notifications] Resend not configured — would send to ${to}: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  } catch (err) {
    console.error(`[notifications] Failed to send email to ${to}:`, err instanceof Error ? err.message : err);
  }
}

export async function handleNotification(event: EventData): Promise<void> {
  const { type, data } = event;

  switch (type) {
    case 'task.completed': {
      // Notify the agent builder that their agent earned money
      const agentId = String(data.agentId ?? '');
      const taskId = String(data.taskId ?? '');
      const latencyMs = data.latencyMs ? `${data.latencyMs}ms` : '—';

      // We need the agent owner's email — look up via registry
      try {
        const regUrl = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';
        const agentRes = await fetch(`${regUrl}/v1/agents/${agentId}`);
        if (agentRes.ok) {
          const agentJson = await agentRes.json() as { data?: { ownerId?: string } };
          const ownerId = agentJson?.data?.ownerId;
          if (ownerId && ownerId !== '00000000-0000-0000-0000-000000000000') {
            const email = await getUserEmail(ownerId);
            if (email) {
              await sendEmail(email, `Task completed — ${agentId}`, emailTemplate(
                'Task Completed',
                `Your agent <strong>${agentId}</strong> completed task <code>${taskId}</code> in ${latencyMs}.<br><br>Payment has been released to your wallet.`,
                'View Dashboard →',
                `${APP_URL}/dashboard`,
              ));
            }
          }
        }
      } catch { /* non-critical */ }
      break;
    }

    case 'wallet.funded': {
      const userId = String(data.userId ?? '');
      const amount = String(data.amount ?? data.usdcAmount ?? '0');
      if (userId) {
        const email = await getUserEmail(userId);
        if (email) {
          await sendEmail(email, `Wallet funded — $${amount} USDC`, emailTemplate(
            'Wallet Funded',
            `Your wallet has been credited with <strong>$${amount} USDC</strong>.`,
            'View Wallet →',
            `${APP_URL}/wallet`,
          ));
        }
      }
      break;
    }

    case 'wallet.withdrawn': {
      const userId = String(data.userId ?? '');
      const amount = String(data.amount ?? '0');
      const destination = String(data.destination ?? '');
      if (userId) {
        const email = await getUserEmail(userId);
        if (email) {
          await sendEmail(email, `Withdrawal processed — $${amount} USDC`, emailTemplate(
            'Withdrawal Processed',
            `Your withdrawal of <strong>$${amount} USDC</strong> to <code>${destination.slice(0, 10)}...${destination.slice(-6)}</code> has been queued for on-chain settlement.`,
            'View Wallet →',
            `${APP_URL}/wallet`,
          ));
        }
      }
      break;
    }

    case 'task.disputed': {
      const taskId = String(data.taskId ?? '');
      const reason = String(data.reason ?? '');
      // Notify both parties — for now just log
      console.log(`[notifications] Task ${taskId} disputed: ${reason}`);
      break;
    }

    default:
      // Other events don't trigger emails
      break;
  }
}
