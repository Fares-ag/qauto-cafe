'use client';

import type { ApiClient } from '@qauto/api-client';
import { useAuthStore } from './auth-store';

type TerminalType = 'POS' | 'BAR_DISPLAY';

/** Resolve or create a branch terminal for sell/kitchen flows (no extra login). */
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
  if (existing) {
    if (type === 'POS') state.setPosTerminalId(existing.id);
    else state.setKitchenTerminalId(existing.id);
    return existing.id;
  }

  const name = type === 'POS' ? 'Main POS' : 'Main Kitchen Display';
  const registered = await client.registerTerminal({ branchId, name, type });
  if (type === 'POS') state.setPosTerminalId(registered.terminalId);
  else state.setKitchenTerminalId(registered.terminalId);
  return registered.terminalId;
}
