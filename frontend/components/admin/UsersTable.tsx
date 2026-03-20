export interface AdminUser {
  id: string;
  email: string;
  role: string | null;
  createdAt: string;
}

function rolePill(role: string | null): string {
  switch (role) {
    case 'builder':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'hire':
      return 'bg-blue/10 text-blue border border-blue/25';
    case 'both':
      return 'bg-purple/10 text-purple border border-purple/25';
    case 'admin':
      return 'bg-red/10 text-red border border-red/25';
    default:
      return 'bg-t-2/15 text-t-2 border border-border';
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function UsersTable({ users }: { users: AdminUser[] }) {
  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      <div
        className="grid bg-bg-2 border-b border-border px-5 py-3"
        style={{ gridTemplateColumns: '2fr 2fr 100px 120px' }}
      >
        {['User ID', 'Email', 'Role', 'Joined'].map((col) => (
          <div
            key={col}
            className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase"
          >
            {col}
          </div>
        ))}
      </div>

      {users.map((user) => (
        <div
          key={user.id}
          className="grid px-5 py-3 border-b border-border last:border-b-0 items-center hover:bg-bg-2/50 transition-colors"
          style={{ gridTemplateColumns: '2fr 2fr 100px 120px' }}
        >
          <div className="font-mono text-[11px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {user.id}
          </div>
          <div className="font-mono text-[12px] text-t-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {user.email}
          </div>
          <div>
            <span
              className={`inline-block font-mono text-[10px] px-2 py-[2px] tracking-[0.04em] ${rolePill(user.role)}`}
            >
              {user.role ?? 'none'}
            </span>
          </div>
          <div className="font-mono text-[10px] text-t-2">{formatDate(user.createdAt)}</div>
        </div>
      ))}

      {users.length === 0 && (
        <div className="px-5 py-8 text-center font-mono text-[12px] text-t-2">
          No users found.
        </div>
      )}
    </div>
  );
}
