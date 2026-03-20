# Frontend Plan A: Project Scaffold + Landing Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js 14 frontend project with the Agntly dark theme (ported from HTML mockups) and build the complete landing page with hero, how-it-works, roles, live ticker, and CTA sections.

**Architecture:** Next.js 14 App Router with Tailwind CSS. The design system (colors, fonts, spacing) is extracted from `app.html` into a Tailwind config. The landing page is a server component with no API calls — all content is static. The animated SVG flow diagram and live ticker are client components.

**Tech Stack:** Next.js 14, Tailwind CSS 3, TypeScript, Google Fonts (IBM Plex Mono, Figtree, DM Sans)

**Source mockup:** `/Users/drpraize/agntly/app.html` — the `#page-landing` section (lines 368-570)

---

## File Structure

```
frontend/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
├── app/
│   ├── layout.tsx              ← Root layout (fonts, theme, grid bg)
│   ├── globals.css             ← Tailwind directives + custom animations
│   └── page.tsx                ← Landing page (assembles sections)
└── components/
    ├── shared/
    │   ├── GridBackground.tsx  ← CSS grid overlay
    │   ├── Footer.tsx          ← Chain pill + links
    │   └── StatusPill.tsx      ← Online/busy/offline pill (shared)
    └── landing/
        ├── LandingNav.tsx      ← Logo + CTAs
        ├── HeroSection.tsx     ← Title, subtitle, CTAs, stats
        ├── FlowDiagram.tsx     ← Animated SVG (client component)
        ├── HowItWorks.tsx      ← 3-step cards
        ├── RolesSection.tsx    ← 3-column role grid
        ├── LiveTicker.tsx      ← Scrolling settlement strip (client)
        └── CTASection.tsx      ← Final CTA block
```

---

## Task 1: Next.js project scaffold + Tailwind theme

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/next.config.js`
- Create: `frontend/app/globals.css`
- Create: `frontend/app/layout.tsx`

- [ ] **Step 1: Create package.json**

Create `frontend/package.json`:

```json
{
  "name": "@agntly/frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tailwind.config.ts**

Create `frontend/tailwind.config.ts` — this extracts the exact design system from the HTML mockups:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#07090d',
          1: '#0d1117',
          2: '#131920',
          3: '#1a2332',
        },
        border: {
          DEFAULT: '#1e2d3d',
          2: '#243447',
        },
        t: {
          0: '#e8edf2',
          1: '#8fa8c0',
          2: '#4d6478',
          3: '#2a3d52',
        },
        accent: {
          DEFAULT: '#00e5a0',
          2: '#00b87a',
        },
        blue: '#4d9ef5',
        amber: '#f5a623',
        red: '#e05252',
        purple: '#9b7cf8',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['Figtree', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s ease both',
        'scroll-left': 'scroll-left 22s linear infinite',
        'drift-1': 'drift 12s ease-in-out infinite alternate',
        'drift-2': 'drift 16s ease-in-out infinite alternate-reverse',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.7)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scroll-left': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        drift: {
          from: { transform: 'translate(0, 0)' },
          to: { transform: 'translate(40px, 30px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Create postcss.config.js and next.config.js**

Create `frontend/postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `frontend/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
```

- [ ] **Step 4: Create globals.css**

Create `frontend/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #243447; }

/* Animated dash for SVG flow lines */
@keyframes dash-flow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -14; }
}

.animate-dash {
  animation: dash-flow 1s linear infinite;
}

/* Fade-up delay utilities */
.delay-100 { animation-delay: 0.1s; }
.delay-200 { animation-delay: 0.2s; }
.delay-300 { animation-delay: 0.3s; }
.delay-400 { animation-delay: 0.4s; }
```

- [ ] **Step 5: Create root layout.tsx**

Create `frontend/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Figtree, DM_Sans } from 'next/font/google';
import './globals.css';

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Agntly — The Payment Layer for AI Agents',
  description: 'Agents that earn. Agents that pay each other. Every AI agent gets its own wallet with automatic escrow and on-chain settlement.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexMono.variable} ${figtree.variable} ${dmSans.variable}`}>
      <body className="bg-bg-0 text-t-0 font-sans antialiased min-h-screen overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create a minimal page.tsx to verify**

Create `frontend/app/page.tsx`:

```tsx
export default function LandingPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="font-display text-4xl font-semibold text-t-0">
        Agntly<span className="text-accent">.</span>
      </h1>
    </div>
  );
}
```

- [ ] **Step 7: Install and verify**

Run: `cd /Users/drpraize/agntly/frontend && pnpm install && pnpm build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Next.js frontend with Agntly dark theme"
```

---

## Task 2: Shared components (GridBackground, Footer)

**Files:**
- Create: `frontend/components/shared/GridBackground.tsx`
- Create: `frontend/components/shared/Footer.tsx`

- [ ] **Step 1: Create GridBackground.tsx**

Create `frontend/components/shared/GridBackground.tsx`:

```tsx
export function GridBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        backgroundImage: 'linear-gradient(#1e2d3d 1px, transparent 1px), linear-gradient(90deg, #1e2d3d 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        opacity: 0.12,
      }}
    />
  );
}
```

- [ ] **Step 2: Create Footer.tsx**

Create `frontend/components/shared/Footer.tsx`:

```tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border px-12 py-6 flex items-center justify-between">
      <div className="flex gap-6">
        {['docs', 'sdk', 'status', 'github', 'discord'].map((item) => (
          <Link
            key={item}
            href="#"
            className="font-mono text-[11px] text-t-2 hover:text-t-1 transition-colors"
          >
            {item}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2 font-mono text-[11px] text-t-2">
        <div className="flex items-center gap-1 bg-accent/[0.07] border border-accent/20 px-2 py-0.5 text-accent text-[10px]">
          <span className="w-[5px] h-[5px] rounded-full bg-accent animate-pulse-dot" />
          Base L2 · USDC
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/shared/
git commit -m "feat: add GridBackground and Footer shared components"
```

---

## Task 3: LandingNav + HeroSection + FlowDiagram

**Files:**
- Create: `frontend/components/landing/LandingNav.tsx`
- Create: `frontend/components/landing/HeroSection.tsx`
- Create: `frontend/components/landing/FlowDiagram.tsx`

- [ ] **Step 1: Create LandingNav.tsx**

Create `frontend/components/landing/LandingNav.tsx`:

```tsx
import Link from 'next/link';

export function LandingNav() {
  return (
    <nav className="relative z-10 flex items-center justify-between px-12 py-5 border-b border-white/[0.04]">
      <div className="font-mono text-base font-medium text-accent flex items-center gap-2.5 tracking-tight">
        <span className="w-2 h-2 bg-accent rounded-full animate-pulse-dot" />
        AGNTLY.IO
      </div>
      <div className="flex gap-3 items-center">
        <Link
          href="/marketplace"
          className="bg-transparent border border-border-2 text-t-1 font-mono text-xs px-[18px] py-2 hover:border-accent hover:text-accent transition-all tracking-wider"
        >
          browse registry
        </Link>
        <Link
          href="/onboard"
          className="bg-transparent border border-border-2 text-t-1 font-mono text-xs px-[18px] py-2 hover:border-accent hover:text-accent transition-all tracking-wider"
        >
          list your agent
        </Link>
        <Link
          href="/onboard"
          className="bg-accent border-none text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-all tracking-wider"
        >
          get started
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create FlowDiagram.tsx**

Create `frontend/components/landing/FlowDiagram.tsx` — this is a client component because of the animated SVG:

```tsx
'use client';

export function FlowDiagram() {
  return (
    <div className="relative w-full max-w-[760px] mx-auto animate-fade-up delay-300">
      <svg className="w-full h-[120px]" viewBox="0 0 760 110" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#00e5a0" strokeWidth="1.5"/>
          </marker>
          <marker id="arr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#4d9ef5" strokeWidth="1.5"/>
          </marker>
        </defs>
        {/* User */}
        <rect x="20" y="30" width="110" height="50" rx="2" fill="#0d1117" stroke="#243447" strokeWidth="1"/>
        <text x="75" y="52" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="11" fill="#8fa8c0">User</text>
        <text x="75" y="70" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d6478">funds wallet</text>
        {/* Arrow 1 */}
        <line x1="131" y1="55" x2="175" y2="55" stroke="#00e5a0" strokeWidth="1" markerEnd="url(#arr)" strokeDasharray="4 3" className="animate-dash"/>
        {/* Orchestrator */}
        <rect x="177" y="20" width="130" height="70" rx="2" fill="#0d1117" stroke="#00e5a0" strokeWidth="1"/>
        <text x="242" y="48" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="11" fill="#e8edf2">Orchestrator</text>
        <text x="242" y="65" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d6478">assigns tasks</text>
        <text x="242" y="80" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#00e5a0">$0.10 budget</text>
        {/* Arrows to sub-agents */}
        <line x1="308" y1="40" x2="360" y2="30" stroke="#4d9ef5" strokeWidth="1" markerEnd="url(#arr2)" strokeDasharray="4 3" className="animate-dash" style={{animationDuration:'0.9s'}}/>
        <line x1="308" y1="55" x2="360" y2="55" stroke="#4d9ef5" strokeWidth="1" markerEnd="url(#arr2)" strokeDasharray="4 3" className="animate-dash" style={{animationDuration:'1.1s'}}/>
        <line x1="308" y1="70" x2="360" y2="80" stroke="#4d9ef5" strokeWidth="1" markerEnd="url(#arr2)" strokeDasharray="4 3" className="animate-dash" style={{animationDuration:'1.3s'}}/>
        {/* Sub agents */}
        <rect x="362" y="10" width="115" height="38" rx="2" fill="#0d1117" stroke="#243447" strokeWidth="1"/>
        <text x="419" y="27" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fill="#8fa8c0">Web Search</text>
        <text x="419" y="41" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d9ef5">$0.002/call</text>
        <rect x="362" y="56" width="115" height="38" rx="2" fill="#0d1117" stroke="#243447" strokeWidth="1"/>
        <text x="419" y="73" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fill="#8fa8c0">CodeExec</text>
        <text x="419" y="87" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d9ef5">$0.005/call</text>
        <text x="419" y="9" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8" fill="#4d6478">escrow locked</text>
        {/* Arrows to settlement */}
        <line x1="478" y1="30" x2="528" y2="45" stroke="#00e5a0" strokeWidth="1" markerEnd="url(#arr)" strokeDasharray="4 3" className="animate-dash"/>
        <line x1="478" y1="75" x2="528" y2="60" stroke="#00e5a0" strokeWidth="1" markerEnd="url(#arr)" strokeDasharray="4 3" style={{animationDuration:'1.2s'}}/>
        {/* Settlement */}
        <rect x="530" y="25" width="130" height="60" rx="2" fill="#0d1117" stroke="#00e5a0" strokeWidth="1"/>
        <text x="595" y="48" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fill="#e8edf2">Settlement</text>
        <text x="595" y="63" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#00e5a0">Base L2 · USDC</text>
        <text x="595" y="78" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#4d6478">on-chain proof</text>
        {/* Receipt */}
        <line x1="661" y1="55" x2="710" y2="55" stroke="#00e5a0" strokeWidth="1" markerEnd="url(#arr)" strokeDasharray="4 3" className="animate-dash"/>
        <rect x="712" y="30" width="40" height="50" rx="2" fill="#0d1117" stroke="#243447" strokeWidth="1"/>
        <text x="732" y="52" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#8fa8c0">Rcpt</text>
        <text x="732" y="66" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8" fill="#4d6478">audit</text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 3: Create HeroSection.tsx**

Create `frontend/components/landing/HeroSection.tsx`:

```tsx
import Link from 'next/link';
import { FlowDiagram } from './FlowDiagram';

export function HeroSection() {
  return (
    <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-12 py-20 gap-7">
      {/* Eyebrow */}
      <div className="font-mono text-[11px] text-accent tracking-[0.14em] uppercase flex items-center gap-2 animate-fade-up">
        <span className="w-8 h-px bg-accent" />
        the payment layer for AI agents
        <span className="w-8 h-px bg-accent" />
      </div>

      {/* Title */}
      <h1 className="font-display text-[clamp(44px,6.5vw,82px)] font-semibold leading-none tracking-tight text-t-0 animate-fade-up delay-100">
        Agents that<br />
        <em className="not-italic text-accent">earn.</em> Agents that<br />
        <span className="text-t-2">pay each other.</span>
      </h1>

      {/* Subtitle */}
      <p className="text-[clamp(16px,2vw,20px)] text-t-1 max-w-[600px] leading-relaxed font-light animate-fade-up delay-200">
        Agntly gives every AI agent its own wallet. Orchestrators hire sub-agents, escrow funds automatically, and settle on-chain — no human in the loop.
      </p>

      {/* CTAs */}
      <div className="flex gap-3.5 items-center flex-wrap justify-center animate-fade-up delay-300">
        <Link
          href="/onboard"
          className="bg-accent text-bg-0 font-mono text-[13px] font-medium px-8 py-3.5 hover:bg-accent-2 hover:-translate-y-px transition-all tracking-wider"
        >
          start building →
        </Link>
        <Link
          href="/marketplace"
          className="bg-transparent text-t-1 border border-border-2 font-mono text-[13px] px-7 py-3.5 hover:border-t-1 hover:text-t-0 transition-all tracking-wider"
        >
          browse the registry
        </Link>
      </div>

      {/* Flow Diagram */}
      <FlowDiagram />

      {/* Stats */}
      <div className="flex gap-12 animate-fade-up delay-400">
        {[
          { num: '2,847', label: 'registered agents' },
          { num: '94k+', label: 'tasks / day' },
          { num: '$1.24M', label: 'total settled' },
        ].map(({ num, label }) => (
          <div key={label} className="flex flex-col gap-1 items-center">
            <div className="font-mono text-[22px] font-medium text-t-0">{num}</div>
            <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/landing/LandingNav.tsx frontend/components/landing/HeroSection.tsx frontend/components/landing/FlowDiagram.tsx
git commit -m "feat: add LandingNav, HeroSection, and animated FlowDiagram"
```

---

## Task 4: HowItWorks + RolesSection + LiveTicker + CTASection

**Files:**
- Create: `frontend/components/landing/HowItWorks.tsx`
- Create: `frontend/components/landing/RolesSection.tsx`
- Create: `frontend/components/landing/LiveTicker.tsx`
- Create: `frontend/components/landing/CTASection.tsx`

- [ ] **Step 1: Create HowItWorks.tsx**

Create `frontend/components/landing/HowItWorks.tsx`:

```tsx
const steps = [
  { num: '01', heading: 'Build an agent', body: 'Write any agent in Python, JS, or any language. Add 3 lines of Agntly SDK. Your agent now has a wallet and can accept paid tasks from other agents.', tag: 'pip install agntly' },
  { num: '02', heading: 'List on the registry', body: 'Publish your agent to the marketplace. Set a price per call. Other orchestrator agents can discover it, hire it, and pay it — automatically, no invoices needed.', tag: '$0.001 – $0.01 / call' },
  { num: '03', heading: 'Earn while you sleep', body: 'Every time your agent completes a task, USDC settles to your wallet on Base L2. Watch your earnings accumulate in real time. Withdraw anytime.', tag: 'settled on-chain' },
];

export function HowItWorks() {
  return (
    <section className="relative z-10 px-12 py-20 border-t border-border">
      <div className="font-mono text-[11px] text-accent tracking-[0.14em] uppercase text-center mb-4">how it works</div>
      <h2 className="font-display text-[clamp(28px,3.5vw,42px)] font-semibold text-center text-t-0 tracking-tight mb-16">
        Three roles. One network.
      </h2>
      <div className="grid grid-cols-3 gap-0 relative">
        {/* Connecting line */}
        <div className="absolute top-9 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-px bg-gradient-to-r from-accent via-blue to-purple opacity-40" />
        {steps.map(({ num, heading, body, tag }) => (
          <div key={num} className="px-8 flex flex-col items-center text-center gap-4 relative">
            <div className="w-[72px] h-[72px] border border-border-2 flex items-center justify-center font-mono text-[13px] font-medium text-accent bg-bg-1 relative z-10">
              {num}
            </div>
            <div className="font-display text-xl font-semibold text-t-0">{heading}</div>
            <p className="text-sm text-t-1 leading-relaxed">{body}</p>
            <span className="font-mono text-[10px] text-accent bg-accent/[0.08] border border-accent/20 px-2.5 py-1 tracking-wider">
              {tag}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create RolesSection.tsx**

Create `frontend/components/landing/RolesSection.tsx`:

```tsx
import Link from 'next/link';

const roles = [
  {
    icon: '🔨', subtitle: 'agent developer', title: 'Build & Earn',
    desc: 'Write an AI agent. List it on the registry. Earn USDC every time another agent hires it.',
    points: ['Set your own price per call', 'Auto-receive payments on completion', 'Track earnings in real-time'],
    cta: 'start building →',
  },
  {
    icon: '🎯', subtitle: 'orchestrator', title: 'Hire & Pay',
    desc: 'Build pipelines that hire specialist agents. Pay per task. No contracts, no invoices.',
    points: ['Browse 2,800+ agents', 'Escrow-protected payments', 'On-chain settlement proof'],
    cta: 'browse agents →',
  },
  {
    icon: '👤', subtitle: 'end user', title: 'Use & Trust',
    desc: 'Use AI products built on Agntly. Every result is backed by an on-chain receipt.',
    points: ['Fund wallet with card or crypto', 'Transparent per-task pricing', 'Verifiable on-chain receipts'],
    cta: 'learn more →',
  },
];

export function RolesSection() {
  return (
    <section className="relative z-10 px-12 py-20 border-t border-border bg-bg-1">
      <div className="max-w-[1100px] mx-auto">
        <div className="font-mono text-[11px] text-accent tracking-[0.14em] uppercase text-center mb-4">who uses agntly</div>
        <h2 className="font-display text-[clamp(28px,3.5vw,42px)] font-semibold text-center text-t-0 tracking-tight mb-12">
          Pick your role
        </h2>
        <div className="grid grid-cols-3 gap-px bg-border border border-border">
          {roles.map(({ icon, subtitle, title, desc, points, cta }) => (
            <Link
              key={title}
              href="/onboard"
              className="bg-bg-1 p-9 flex flex-col gap-4 hover:bg-bg-2 transition-colors"
            >
              <div className="w-12 h-12 border border-border-2 flex items-center justify-center text-xl">{icon}</div>
              <div>
                <div className="font-mono text-[11px] text-accent tracking-wider uppercase">{subtitle}</div>
                <div className="font-display text-[22px] font-bold text-t-0">{title}</div>
              </div>
              <p className="text-sm text-t-1 leading-relaxed">{desc}</p>
              <ul className="flex flex-col gap-2 mt-1">
                {points.map((point) => (
                  <li key={point} className="font-mono text-xs text-t-2 flex items-start gap-2">
                    <span className="text-accent shrink-0">→</span>
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-auto font-mono text-xs text-accent flex items-center gap-1.5 hover:gap-2.5 transition-all">
                {cta}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create LiveTicker.tsx**

Create `frontend/components/landing/LiveTicker.tsx` — client component with scrolling animation:

```tsx
'use client';

const TICKS = [
  { agent: 'WebSearch Alpha', task: 'search query', price: '$0.0020' },
  { agent: 'CodeExec Pro', task: 'python execution', price: '$0.0050' },
  { agent: 'PDFParser NX', task: 'document parse', price: '$0.0010' },
  { agent: 'DataWrangler v2', task: 'csv transform', price: '$0.0030' },
  { agent: 'API Relay Turbo', task: 'api proxy call', price: '$0.0015' },
  { agent: 'Summarizer CTX', task: 'text summarize', price: '$0.0040' },
];

function TickItems() {
  return (
    <>
      {TICKS.map(({ agent, task, price }, i) => (
        <div key={i} className="font-mono text-xs whitespace-nowrap flex gap-2 items-center">
          <span className="text-t-0">{agent}</span>
          <span className="text-t-3">→</span>
          <span className="text-t-2">{task}</span>
          <span className="text-accent">{price}</span>
          <span className="text-t-3">·</span>
        </div>
      ))}
    </>
  );
}

export function LiveTicker() {
  return (
    <div className="relative z-10 px-12 py-6 border-t border-b border-border bg-bg-0 flex items-center gap-5 overflow-hidden">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase shrink-0 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-dot" />
        live settlements
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="flex gap-10 animate-scroll-left w-max">
          <TickItems />
          <TickItems />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create CTASection.tsx**

Create `frontend/components/landing/CTASection.tsx`:

```tsx
import Link from 'next/link';

export function CTASection() {
  return (
    <section className="relative z-10 px-12 py-24 text-center flex flex-col items-center gap-6">
      <h2 className="font-display text-[clamp(32px,4.5vw,52px)] font-semibold text-t-0 tracking-tight">
        Ready to build?
      </h2>
      <p className="text-base text-t-1 max-w-[480px] leading-relaxed">
        Join thousands of developers building the agent economy. List your first agent in under 5 minutes.
      </p>
      <div className="flex gap-3.5 flex-wrap justify-center">
        <Link
          href="/onboard"
          className="bg-accent text-bg-0 font-mono text-[13px] font-medium px-8 py-3.5 hover:bg-accent-2 transition-all tracking-wider"
        >
          get started →
        </Link>
        <Link
          href="/marketplace"
          className="bg-transparent text-t-1 border border-border-2 font-mono text-[13px] px-7 py-3.5 hover:border-t-1 hover:text-t-0 transition-all tracking-wider"
        >
          explore the marketplace
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/landing/
git commit -m "feat: add HowItWorks, RolesSection, LiveTicker, and CTASection"
```

---

## Task 5: Assemble landing page + glow orbs

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Assemble the full landing page**

Replace `frontend/app/page.tsx`:

```tsx
import { GridBackground } from '@/components/shared/GridBackground';
import { Footer } from '@/components/shared/Footer';
import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { RolesSection } from '@/components/landing/RolesSection';
import { LiveTicker } from '@/components/landing/LiveTicker';
import { CTASection } from '@/components/landing/CTASection';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen overflow-hidden relative">
      <GridBackground />

      {/* Glow orbs */}
      <div className="absolute w-[600px] h-[600px] bg-accent rounded-full blur-[120px] opacity-[0.18] -top-[200px] -left-[100px] pointer-events-none animate-drift-1" />
      <div className="absolute w-[400px] h-[400px] bg-blue rounded-full blur-[120px] opacity-[0.18] -bottom-[100px] -right-[100px] pointer-events-none animate-drift-2" />

      <LandingNav />
      <HeroSection />
      <HowItWorks />
      <RolesSection />
      <LiveTicker />
      <CTASection />
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Add path alias to tsconfig.json**

Create or update `frontend/tsconfig.json` to include the `@/` path alias:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/drpraize/agntly/frontend && pnpm build`
Expected: Build succeeds. Run `pnpm dev` and open http://localhost:3000 to visually verify the landing page matches `app.html`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/page.tsx frontend/tsconfig.json
git commit -m "feat: assemble complete landing page with all sections"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Next.js scaffold + Tailwind theme | `package.json`, `tailwind.config.ts`, `layout.tsx`, `globals.css` |
| 2 | Shared components | `GridBackground.tsx`, `Footer.tsx` |
| 3 | Hero section + flow diagram | `LandingNav.tsx`, `HeroSection.tsx`, `FlowDiagram.tsx` |
| 4 | Remaining landing sections | `HowItWorks.tsx`, `RolesSection.tsx`, `LiveTicker.tsx`, `CTASection.tsx` |
| 5 | Assemble page + path aliases | `page.tsx`, `tsconfig.json` |

**Total: 5 tasks, ~15 files. The landing page is a direct port of app.html #page-landing.**
