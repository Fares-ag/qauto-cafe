'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@qauto/ui';
import type { BillingParty } from '@qauto/shared-types';
import { withAuth } from '@/lib/api';

export type DirectoryEntry = {
  id: string;
  name: string;
  department: string | null;
  phoneExtension: string | null;
  position?: string | null;
  pointsBalance: number;
};

export type RegisterCustomerValue = {
  mode: 'extension' | 'walkin' | 'guest';
  customerId: string | null;
  customerName: string;
  customerDepartment: string;
  billingParty: BillingParty;
  guestName: string;
  phoneExtension: string;
};

type Props = {
  value: RegisterCustomerValue;
  onChange: (value: RegisterCustomerValue) => void;
  disabled?: boolean;
};

const EMPTY: RegisterCustomerValue = {
  mode: 'extension',
  customerId: null,
  customerName: '',
  customerDepartment: '',
  billingParty: 'INDIVIDUAL',
  guestName: '',
  phoneExtension: '',
};

export function emptyRegisterCustomer(): RegisterCustomerValue {
  return { ...EMPTY };
}

export function RegisterCustomerPanel({ value, onChange, disabled }: Props) {
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [staffQuery, setStaffQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDepartments = useCallback(async () => {
    const deptList = await withAuth((client) => client.getCustomerDepartments());
    setDepartments(deptList);
  }, []);

  const loadDirectory = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const entries = await withAuth((client) => client.getCustomerDirectory(query));
      setDirectory(entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments().catch(() => undefined);
  }, [loadDepartments]);

  useEffect(() => {
    const q = staffQuery.trim();
    const timer = setTimeout(() => {
      loadDirectory(q || undefined).catch(() => undefined);
    }, q ? 200 : 0);
    return () => clearTimeout(timer);
  }, [staffQuery, loadDirectory]);

  const filteredDirectory = useMemo(() => directory, [directory]);

  function setMode(mode: RegisterCustomerValue['mode']) {
    if (mode === 'guest') {
      onChange({
        ...EMPTY,
        mode: 'guest',
        billingParty: 'DEPARTMENT',
        customerDepartment: departments[0] ?? '',
      });
      return;
    }
    if (mode === 'walkin') {
      onChange({
        ...EMPTY,
        mode: 'walkin',
        billingParty: 'INDIVIDUAL',
      });
      return;
    }
    onChange({ ...EMPTY, mode: 'extension', billingParty: 'INDIVIDUAL' });
  }

  function selectStaff(entry: DirectoryEntry) {
    onChange({
      mode: 'extension',
      customerId: entry.id,
      customerName: entry.name,
      customerDepartment: entry.department ?? '',
      billingParty: 'INDIVIDUAL',
      guestName: '',
      phoneExtension: entry.phoneExtension ?? '',
    });
  }

  function clearSelection() {
    onChange(emptyRegisterCustomer());
    setStaffQuery('');
  }

  const hasSelection =
    value.customerName.trim().length > 0 ||
    value.customerDepartment.trim().length > 0 ||
    value.guestName.trim().length > 0;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-sunken/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Customer</p>
        {hasSelection && !disabled ? (
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-raised p-0.5">
        {(
          [
            ['extension', 'Staff'],
            ['walkin', 'Walk-in'],
            ['guest', 'Office guest'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => setMode(mode)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              value.mode === mode
                ? 'bg-brand text-brand-foreground'
                : 'text-ink-secondary hover:bg-surface-sunken disabled:opacity-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {hasSelection ? (
        <div className="rounded-lg bg-brand-muted/40 px-3 py-2 text-sm">
          {value.mode === 'guest' ? (
            <>
              <p className="font-medium text-ink">
                Guest: {value.guestName.trim() || 'Unnamed guest'}
              </p>
              <p className="text-ink-muted">Bill to {value.customerDepartment || 'department'}</p>
            </>
          ) : (
            <>
              <p className="font-medium text-ink">{value.customerName || 'Walk-in'}</p>
              {value.customerDepartment ? (
                <p className="text-ink-muted">{value.customerDepartment}</p>
              ) : null}
              {value.phoneExtension ? (
                <p className="text-xs text-ink-muted">Ext. {value.phoneExtension}</p>
              ) : value.mode === 'extension' && value.customerId ? (
                <p className="text-xs text-ink-muted">No extension</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {value.mode === 'extension' ? (
        <div className="space-y-2">
          <Input
            label="Search staff"
            value={staffQuery}
            onChange={(e) => setStaffQuery(e.target.value)}
            placeholder="Extension, name, or department"
            disabled={disabled}
          />
          {loading ? (
            <p className="text-xs text-ink-muted">Loading staff directory…</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {filteredDirectory.length === 0 ? (
                <li className="px-2 py-3 text-center text-xs text-ink-muted">
                  No staff found
                </li>
              ) : (
                filteredDirectory.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => selectStaff(entry)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-raised ${
                        value.customerId === entry.id ? 'bg-brand-muted ring-1 ring-brand/30' : ''
                      }`}
                    >
                      {entry.phoneExtension ? (
                        <span className="min-w-[3rem] font-mono text-xs font-bold text-brand">
                          {entry.phoneExtension}
                        </span>
                      ) : (
                        <span className="min-w-[3rem] shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                          No ext.
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{entry.name}</span>
                        {entry.position ? (
                          <span className="block truncate text-xs text-ink-muted">{entry.position}</span>
                        ) : null}
                        {entry.department ? (
                          <span className="block truncate text-xs text-ink-muted">{entry.department}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : null}

      {value.mode === 'walkin' ? (
        <div className="space-y-2">
          <Input
            label="Customer name"
            value={value.customerName}
            onChange={(e) =>
              onChange({
                ...value,
                customerName: e.target.value,
                customerId: null,
                billingParty: 'INDIVIDUAL',
              })
            }
            placeholder="Optional"
            disabled={disabled}
          />
          <Input
            label="Department or note"
            value={value.customerDepartment}
            onChange={(e) =>
              onChange({ ...value, customerDepartment: e.target.value, customerId: null })
            }
            placeholder="Optional"
            disabled={disabled}
          />
        </div>
      ) : null}

      {value.mode === 'guest' ? (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Bill to department</span>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={value.customerDepartment}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  customerDepartment: e.target.value,
                  customerId: null,
                  billingParty: 'DEPARTMENT',
                })
              }
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Guest name"
            value={value.guestName}
            onChange={(e) =>
              onChange({
                ...value,
                guestName: e.target.value,
                customerName: e.target.value,
                billingParty: 'DEPARTMENT',
                customerId: null,
              })
            }
            placeholder="Visitor or meeting guest"
            disabled={disabled}
          />
          <p className="text-xs text-ink-muted">
            Charge goes to the department account, not an individual staff member.
          </p>
        </div>
      ) : null}
    </div>
  );
}
