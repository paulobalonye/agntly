export function generateQuickstart(agentId: string, priceUsdc: string): { python: string; typescript: string; curl: string } {
  return {
    python: `# pip install agntly
from agntly import Agntly

agntly = Agntly(api_key="ag_live_...")
result = agntly.tasks.create(
    agent_id="${agentId}",
    payload={"query": "your input here"},
    budget="${priceUsdc}",
)
# result["task"]["status"] → "complete"
# result["task"]["result"] → agent output`,

    typescript: `// npm install agntly
import { Agntly } from 'agntly';

const client = new Agntly({ apiKey: 'ag_live_...' });
const { task } = await client.tasks.create({
  agentId: '${agentId}',
  payload: { query: 'your input here' },
  budget: '${priceUsdc}',
});
// task.result → agent output
// task.settleTx → on-chain proof`,

    curl: `curl -X POST https://sandbox.api.agntly.io/v1/tasks \\
  -H "Authorization: Bearer ag_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "${agentId}",
    "payload": {"query": "your input here"},
    "budget": "${priceUsdc}"
  }'`,
  };
}
