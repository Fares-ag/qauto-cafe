'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@qauto/ui';
import { withAuth } from '@/lib/api';

export interface CustomerOption {
  id: string;
  name: string;
  department: string | null;
  pointsBalance: number;
}

interface CustomerAutocompleteProps {
  value: CustomerOption | null;
  onChange: (customer: CustomerOption | null) => void;
  disabled?: boolean;
}

export function CustomerAutocomplete({ value, onChange, disabled }: CustomerAutocompleteProps) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.name ?? '');
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const results = await withAuth((client) => client.searchCustomers(q));
      setOptions(
        results.map((c) => ({
          id: c.id,
          name: c.name,
          department: c.department,
          pointsBalance: c.pointsBalance,
        })),
      );
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(text: string) {
    setQuery(text);
    onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 250);
  }

  function selectCustomer(customer: CustomerOption) {
    setQuery(customer.name);
    onChange(customer);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        label="Customer"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="Search by name, email, or department"
        disabled={disabled}
      />
      {loading ? (
        <p className="mt-1 text-xs text-ink-muted">Searching…</p>
      ) : null}
      {open && options.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-surface-raised shadow-soft">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-sunken"
                onClick={() => selectCustomer(option)}
              >
                <span className="font-medium text-ink">{option.name}</span>
                {option.department ? (
                  <span className="ml-2 text-ink-muted">{option.department}</span>
                ) : null}
                {option.pointsBalance > 0 ? (
                  <span className="ml-2 text-xs text-accent">{option.pointsBalance} pts</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
