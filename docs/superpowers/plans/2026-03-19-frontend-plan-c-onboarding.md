# Plan C: Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 3-step onboarding wizard ported from `app.html #page-onboard` — role selection, framework picker with live code preview, and wallet setup. Client component with local step state.

**Architecture:** Single client component (`OnboardingWizard`) manages step state (0, 1, 2) and selections (role, framework). Each step is a separate sub-component. No API calls — this is a guided introduction flow. On completion, redirects to `/marketplace`.

**Tech Stack:** Next.js 14, Tailwind CSS, TypeScript, React useState

**Source mockup:** `/Users/drpraize/agntly/app.html` lines 572-682 (`#page-onboard` section)

---

## File Structure

```
frontend/
├── app/
│   └── onboard/
│       └── page.tsx                  ← Onboarding page
└── components/
    └── onboarding/
        ├── OnboardingWizard.tsx      ← Step state manager (client)
        ├── RoleStep.tsx              ← Step 1: role selection
        ├── FrameworkStep.tsx          ← Step 2: framework + code preview
        └── WalletStep.tsx            ← Step 3: wallet setup
```

---

## Task 1: Onboarding components

All 4 components in one task since they're tightly coupled (wizard manages steps, each step is a sub-component).

**Files:**
- Create: `frontend/components/onboarding/RoleStep.tsx`
- Create: `frontend/components/onboarding/FrameworkStep.tsx`
- Create: `frontend/components/onboarding/WalletStep.tsx`
- Create: `frontend/components/onboarding/OnboardingWizard.tsx`
- Create: `frontend/app/onboard/page.tsx`

### RoleStep.tsx

Props: `{ selected: string; onSelect: (role: string) => void }`

Three role option cards in a 3-column grid:
- 🔨 **Build & earn** — "I want to publish an agent and earn per call" (value: `'builder'`)
- ⚙️ **Hire agents** — "I want to use agents in my pipeline" (value: `'hire'`)
- ⚡ **Both** — "I build agents and use other agents" (value: `'both'`)

Selected card has green border + green bg. Same style as mockup: `role-opt` class.

### FrameworkStep.tsx

Props: `{ selected: string; onSelect: (fw: string) => void }`

6 framework options in a 2-column grid:
- **PY** (blue) — Python (raw SDK) — "Any Python agent or script"
- **CR** (green) — CrewAI — "Multi-agent crew pipelines"
- **AG** (amber) — AutoGen — "Microsoft AutoGen agents"
- **LG** (purple) — LangGraph — "LangChain graph agents"
- **API** (red) — REST API — "Any language via HTTP"
- **JS** (amber) — JavaScript / TS — "Node.js or browser agents"

Below the grid: a code preview block that changes based on selected framework. Use a `Record<string, string>` mapping framework → code snippet:

```typescript
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
```

Code block styled with: dark bg, monospace, syntax-colored (blue for keywords, green for strings, gray for comments). Use simple string replacement for highlighting or just render as plain monospace text matching the mockup.

### WalletStep.tsx

Props: `{ onComplete: () => void }`

- Input row: text input (placeholder "Paste existing wallet address (optional)") + "auto-create" button
- Info box with green left border: explains ERC-4337 wallets, no seed phrase, $0 to create
- After clicking "auto-create": show a simulated wallet created confirmation box with a generated address (`0xA9c3…4D77`), balance `0.0000 USDC`, chain `Base L2`

No real API call — wallet creation is simulated for the onboarding flow. Real wallet creation happens when the user takes their first action.

### OnboardingWizard.tsx

Client component (`'use client'`). Manages:
- `step` state (0, 1, 2)
- `role` state (default: `'builder'`)
- `framework` state (default: `'python'`)

Renders:
- Header: logo + "skip to marketplace →" link
- Progress bar: 3 segments, active/done segments are green
- Step label: "step N of 3 — ..."
- Title + description (changes per step)
- Current step component
- Footer: back button + next/finish button

Step transitions:
- Step 0 → 1: next button
- Step 1 → 2: next button
- Step 2 → complete: "enter registry →" button → `router.push('/marketplace')`
- Back: goes to previous step (step 0 back → `/` landing page)

### page.tsx

Server component wrapper:
```tsx
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function OnboardPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-10 bg-bg-0">
      <OnboardingWizard />
    </div>
  );
}
```

### After implementing:
1. Create directories: `mkdir -p frontend/components/onboarding frontend/app/onboard`
2. Build: `cd /Users/drpraize/agntly/frontend && pnpm build`
3. Commit:
```bash
git add frontend/components/onboarding/ frontend/app/onboard/
git commit -m "feat: add 3-step onboarding wizard with role, framework, and wallet setup"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Complete onboarding wizard | `OnboardingWizard.tsx`, `RoleStep.tsx`, `FrameworkStep.tsx`, `WalletStep.tsx`, `page.tsx` |

**Total: 1 task, 5 files. Pure client-side component with no API calls.**
