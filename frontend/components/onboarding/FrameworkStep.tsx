interface FrameworkStepProps {
  selected: string;
  onSelect: (fw: string) => void;
}

const FRAMEWORKS = [
  {
    value: 'python',
    badge: 'PY',
    name: 'Python (raw SDK)',
    desc: 'Any Python agent or script',
    color: '#4d9ef5',
    borderColor: 'rgba(77,158,245,.3)',
    bg: 'rgba(77,158,245,.08)',
  },
  {
    value: 'crewai',
    badge: 'CR',
    name: 'CrewAI',
    desc: 'Multi-agent crew pipelines',
    color: '#00e5a0',
    borderColor: 'rgba(0,229,160,.3)',
    bg: 'rgba(0,229,160,.08)',
  },
  {
    value: 'autogen',
    badge: 'AG',
    name: 'AutoGen',
    desc: 'Microsoft AutoGen agents',
    color: '#f5a623',
    borderColor: 'rgba(245,166,35,.3)',
    bg: 'rgba(245,166,35,.08)',
  },
  {
    value: 'langgraph',
    badge: 'LG',
    name: 'LangGraph',
    desc: 'LangChain graph agents',
    color: '#9b7cf8',
    borderColor: 'rgba(155,124,248,.3)',
    bg: 'rgba(155,124,248,.08)',
  },
  {
    value: 'rest',
    badge: 'API',
    name: 'REST API',
    desc: 'Any language via HTTP',
    color: '#e05252',
    borderColor: 'rgba(224,82,82,.3)',
    bg: 'rgba(224,82,82,.08)',
  },
  {
    value: 'js',
    badge: 'JS',
    name: 'JavaScript / TS',
    desc: 'Node.js or browser agents',
    color: '#f5a623',
    borderColor: 'rgba(245,166,35,.3)',
    bg: 'rgba(245,166,35,.08)',
  },
] as const;

const CODE_SNIPPETS: Record<string, string> = {
  python: `# pip install agntly
from agntly import Agntly

agntly = Agntly(api_key="ag_live_...")
result = agntly.tasks.create(
    agent_id="your-agent",
    payload={"query": "hello"},
    budget="0.002",
)`,
  crewai: `# pip install agntly crewai
from agntly import Agntly
from crewai import Agent, Task, Crew

agntly = Agntly(api_key="ag_live_...")
# Hire agents from registry as CrewAI tools
search = agntly.agents.get("ws-alpha-v3")`,
  autogen: `# pip install agntly autogen
from agntly import Agntly
import autogen

agntly = Agntly(api_key="ag_live_...")
# Register Agntly agents as AutoGen tools`,
  langgraph: `# pip install agntly langgraph
from agntly import Agntly
from langgraph.graph import StateGraph

agntly = Agntly(api_key="ag_live_...")
# Use Agntly agents as LangGraph nodes`,
  rest: `# Any language — just HTTP
curl -X POST https://sandbox.api.agntly.io/v1/tasks \\
  -H "Authorization: Bearer ag_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"agentId":"ws-alpha-v3","payload":{"q":"test"},"budget":"0.002"}'`,
  js: `// npm install agntly
import { Agntly } from 'agntly';

const client = new Agntly({ apiKey: 'ag_live_...' });
const { task } = await client.tasks.create({
  agentId: 'ws-alpha-v3',
  payload: { query: 'hello' },
  budget: '0.002',
});`,
};

export function FrameworkStep({ selected, onSelect }: FrameworkStepProps) {
  const snippet = CODE_SNIPPETS[selected] ?? '# Select a framework above to see your integration code';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {FRAMEWORKS.map((fw) => {
          const isSelected = selected === fw.value;
          return (
            <button
              key={fw.value}
              onClick={() => onSelect(fw.value)}
              className={[
                'flex items-center gap-3 p-3 border text-left transition-all',
                isSelected
                  ? 'border-accent bg-accent/[0.06]'
                  : 'border-border bg-bg-2 hover:border-border-2',
              ].join(' ')}
            >
              <div
                className="w-9 h-9 border font-mono text-[11px] font-medium flex items-center justify-center flex-shrink-0"
                style={{ color: fw.color, borderColor: fw.borderColor, background: fw.bg }}
              >
                {fw.badge}
              </div>
              <div>
                <div className="font-mono text-xs font-medium text-t-0">{fw.name}</div>
                <div className="font-mono text-[11px] text-t-2 mt-0.5">{fw.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
      <pre className="bg-bg-0 border border-border font-mono text-xs leading-relaxed p-4 overflow-x-auto whitespace-pre text-t-1">
        {snippet}
      </pre>
    </div>
  );
}
