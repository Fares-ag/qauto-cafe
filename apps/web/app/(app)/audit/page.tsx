'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, CardHeader, EmptyState, TableSkeleton, useToast } from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type AuditRow = Awaited<
  ReturnType<ReturnType<typeof getApiClient>['getAuditLog']>
>['items'][number];

export default function AuditPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const client = getApiClient();
      const data = await client.getAuditLog({ branchId: branchId ?? undefined, limit: 100 });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load audit log', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Audit log</h1>
        <p className="mt-1 text-sm text-ink-muted">{total} events recorded</p>
      </div>

      <Card padding="lg">
        {loading ? (
          <TableSkeleton rows={10} />
        ) : items.length === 0 ? (
          <EmptyState title="No audit events yet" description="Actions will be logged as staff use the system" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Time</th>
                  <th className="pb-3 pr-4 font-medium">Action</th>
                  <th className="pb-3 pr-4 font-medium">Entity</th>
                  <th className="pb-3 pr-4 font-medium">User</th>
                  <th className="pb-3 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 text-ink-secondary">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="neutral">{row.action}</Badge>
                    </td>
                    <td className="py-3 pr-4">{row.entityType}</td>
                    <td className="py-3 pr-4">{row.userName ?? '—'}</td>
                    <td className="py-3 font-mono text-xs text-ink-muted">{row.entityId.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
