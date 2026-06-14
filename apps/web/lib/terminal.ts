'use client';

import type { ApiClient } from '@qauto/api-client';
import { useAuthStore } from './auth-store';

type TerminalType = 'POS' | 'BAR_DISPLAY';

/** Resolve an existing branch terminal — terminals are provisioned by a manager. */
export async function ensureTerminal(
  client: ApiClient,
  branchId: string,
  type: TerminalType,
): Promise<string> {
  const state = useAuthStore.getState();
  const cached = type === 'POS' ? state.posTerminalId : state.kitchenTerminalId;
  if (cached) return cached;

  const terminals = await client.listTerminals(branchId);
  const existing = terminals.find((t) => t.type === type);
  if (!existing) {
    throw new Error(
      `No ${type === 'POS' ? 'POS' : 'kitchen display'} terminal configured. Ask a manager to register one in Settings.`,
    );
  }

  if (type === 'POS') state.setPosTerminalId(existing.id);
  else state.setKitchenTerminalId(existing.id);
  return existing.id;
}
