'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardHeader, DataTable, Input, PageHeader, useToast } from '@qauto/ui';
import { ConfirmDialog } from '@/components/admin/modal';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useThemeStore } from '@/lib/theme-store';

type TerminalRow = {
  id: string;
  name: string;
  type: string;
  lastSeenAt: string | null;
  isActive?: boolean;
};

export default function SettingsPage() {
  const { branchId, setBranchId } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { toast } = useToast();
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [terminalName, setTerminalName] = useState('');
  const [terminalType, setTerminalType] = useState<'POS' | 'BAR_DISPLAY' | 'ADMIN'>('POS');
  const [registering, setRegistering] = useState(false);
  const [deactivateTerminal, setDeactivateTerminal] = useState<TerminalRow | null>(null);
  const [branchSettings, setBranchSettings] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setBranches(await getApiClient().listBranches());
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load branches', 'error');
    }
  }, [toast]);

  const loadTerminals = useCallback(async () => {
    if (!branchId) return;
    try {
      setTerminals(await getApiClient().listTerminals(branchId));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load terminals', 'error');
    }
  }, [branchId, toast]);

  const loadBranchSettings = useCallback(async () => {
    if (!branchId) return;
    setSettingsLoading(true);
    try {
      const data = await getApiClient().getBranchSettings(branchId);
      setBranchSettings(JSON.stringify(data.settings ?? {}, null, 2));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load branch settings', 'error');
    } finally {
      setSettingsLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTerminals();
    loadBranchSettings();
  }, [loadTerminals, loadBranchSettings]);

  const registerTerminal = async () => {
    if (!branchId || !terminalName.trim()) return;
    setRegistering(true);
    try {
      await getApiClient().registerTerminal({ branchId, name: terminalName.trim(), type: terminalType });
      setTerminalName('');
      toast('Terminal registered', 'success');
      await loadTerminals();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to register terminal', 'error');
    } finally {
      setRegistering(false);
    }
  };

  async function confirmDeactivateTerminal() {
    if (!deactivateTerminal) return;
    try {
      await getApiClient().updateTerminal(deactivateTerminal.id, { isActive: false });
      toast('Terminal deactivated', 'success');
      setDeactivateTerminal(null);
      loadTerminals();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function saveBranchSettings() {
    if (!branchId) return;
    try {
      const parsed = JSON.parse(branchSettings) as Record<string, unknown>;
      await getApiClient().upsertBranchSettings(branchId, { settings: parsed });
      toast('Branch settings saved', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Invalid JSON or save failed', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Branch, terminals, and appearance preferences" />

      <Card padding="lg">
        <CardHeader title="Branch" description="Switch active branch for this session" />
        <div className="space-y-2">
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => {
                setBranchId(branch.id);
                toast(`Switched to ${branch.name}`, 'success');
              }}
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                branchId === branch.id ? 'border-brand bg-brand-muted/40' : 'border-border hover:bg-surface-sunken'
              }`}
            >
              <span className="font-medium text-ink">{branch.name}</span>
              <span className="text-ink-muted">{branch.code}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader title="Branch settings (JSON)" description="Tax, receipt, and operational config" />
        {settingsLoading ? <p className="text-sm text-ink-muted">Loading…</p> : (
          <>
            <textarea
              className="mb-3 min-h-[160px] w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs"
              value={branchSettings}
              onChange={(e) => setBranchSettings(e.target.value)}
            />
            <Button variant="primary" onClick={saveBranchSettings}>Save settings</Button>
          </>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader title="Terminals" description="Register POS and kitchen display terminals for PIN login" />
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input label="Terminal name" value={terminalName} onChange={(e) => setTerminalName(e.target.value)} placeholder="Front counter POS" />
          </div>
          <div className="w-full sm:w-40">
            <label className="mb-1 block text-sm font-medium text-ink-secondary">Type</label>
            <select value={terminalType} onChange={(e) => setTerminalType(e.target.value as typeof terminalType)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="POS">POS</option>
              <option value="BAR_DISPLAY">Kitchen display</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <Button onClick={registerTerminal} disabled={!branchId || !terminalName.trim() || registering}>
            {registering ? 'Registering…' : 'Register'}
          </Button>
        </div>
        <DataTable
          rows={terminals}
          getRowKey={(row) => row.id}
          emptyMessage="No terminals registered for this branch"
          columns={[
            { key: 'name', header: 'Name', cell: (row) => row.name },
            { key: 'type', header: 'Type', cell: (row) => row.type.replace('_', ' ') },
            { key: 'lastSeen', header: 'Last seen', cell: (row) => row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : 'Never' },
            {
              key: 'actions',
              header: '',
              cell: (row) => (
                <Button variant="ghost" size="sm" onClick={() => setDeactivateTerminal(row)}>Deactivate</Button>
              ),
            },
          ]}
        />
      </Card>

      <Card padding="lg">
        <CardHeader title="Appearance" description="Toggle light or dark mode" />
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-secondary">Current theme: <span className="font-medium capitalize text-ink">{theme}</span></p>
          <Button variant="secondary" onClick={toggleTheme}>{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</Button>
        </div>
      </Card>

      <ConfirmDialog open={!!deactivateTerminal} title="Deactivate terminal" message={`Deactivate ${deactivateTerminal?.name}? It will no longer appear for PIN login.`} confirmLabel="Deactivate" loading={registering} onConfirm={confirmDeactivateTerminal} onClose={() => setDeactivateTerminal(null)} />
    </div>
  );
}
