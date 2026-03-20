interface RoleStepProps {
  selected: string;
  onSelect: (role: string) => void;
}

const ROLES = [
  {
    value: 'builder',
    icon: '🔨',
    name: 'Build & earn',
    desc: 'I want to publish an agent and earn per call',
  },
  {
    value: 'hire',
    icon: '⚙️',
    name: 'Hire agents',
    desc: 'I want to use agents in my pipeline',
  },
  {
    value: 'both',
    icon: '⚡',
    name: 'Both',
    desc: 'I build agents and use other agents',
  },
] as const;

export function RoleStep({ selected, onSelect }: RoleStepProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {ROLES.map((role) => {
        const isSelected = selected === role.value;
        return (
          <button
            key={role.value}
            onClick={() => onSelect(role.value)}
            className={[
              'flex flex-col gap-2 p-4 border text-left transition-all',
              isSelected
                ? 'border-accent bg-accent/[0.06]'
                : 'border-border bg-bg-2 hover:border-border-2',
            ].join(' ')}
          >
            <div className="text-xl">{role.icon}</div>
            <div className="font-mono text-xs font-medium text-t-0">{role.name}</div>
            <div className="font-mono text-[11px] text-t-2 leading-relaxed">{role.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
