import type { FastifyPluginAsync } from 'fastify';
import type { RegistryService } from '../services/registry-service.js';

export const badgeRoutes: FastifyPluginAsync = async (app) => {
  const registryService = (app as any).registryService as RegistryService;

  app.get('/:agentId/badge.svg', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const agent = await registryService.getAgent(agentId);

    if (!agent) {
      const svg = generateBadge('agntly', 'not found', '#e05252');
      return reply.type('image/svg+xml').header('Cache-Control', 'no-cache').send(svg);
    }

    const label = 'agntly';
    const uptime = parseFloat(String(agent.uptimePct));
    const rep = parseFloat(String(agent.reputation));
    const value = `${uptime}% · $${agent.priceUsdc}/call · ★${rep.toFixed(1)}`;
    const color = uptime >= 99 ? '#00e5a0' : uptime >= 95 ? '#f5a623' : '#e05252';
    const svg = generateBadge(label, value, color);

    return reply
      .type('image/svg+xml')
      .header('Cache-Control', 'public, max-age=300')
      .send(svg);
  });
};

function generateBadge(label: string, value: string, color: string): string {
  const labelWidth = label.length * 7 + 12;
  const valueWidth = value.length * 6.5 + 12;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <rect width="${labelWidth}" height="20" fill="#0d1117"/>
  <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}20" stroke="${color}40" stroke-width="0.5"/>
  <text x="${labelWidth / 2}" y="14" fill="#00e5a0" font-family="monospace" font-size="11" text-anchor="middle">${label}</text>
  <text x="${labelWidth + valueWidth / 2}" y="14" fill="${color}" font-family="monospace" font-size="10" text-anchor="middle">${value}</text>
</svg>`;
}
