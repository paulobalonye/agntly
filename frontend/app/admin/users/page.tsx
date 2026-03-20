'use client';

import { useState, useEffect } from 'react';
import { UsersTable, type AdminUser } from '@/components/admin/UsersTable';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users?limit=${limit}&offset=${offset}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setUsers(
            json.data.map((u: Record<string, unknown>) => ({
              id: String(u.id ?? ''),
              email: String(u.email ?? ''),
              role: u.role ? String(u.role) : null,
              createdAt: String(u.created_at ?? u.createdAt ?? ''),
            })),
          );
          setTotal(json.meta?.total ?? json.data.length);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [offset]);

  return (
    <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[11px] text-red tracking-[0.1em] uppercase mb-2">admin</div>
        <h1 className="font-display text-[32px] font-semibold text-t-0 leading-tight">Users</h1>
        <p className="font-mono text-[12px] text-t-2 mt-1">{total} total users on the platform</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-[12px] text-t-2">Loading users...</span>
        </div>
      ) : (
        <>
          <UsersTable users={users} />

          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="font-mono text-[11px] text-t-2">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="font-mono text-[11px] px-3 py-1 border border-border text-t-1 hover:border-accent hover:text-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  prev
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="font-mono text-[11px] px-3 py-1 border border-border text-t-1 hover:border-accent hover:text-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
