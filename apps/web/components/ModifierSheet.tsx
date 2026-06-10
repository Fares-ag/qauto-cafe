'use client';

import { useEffect, useState } from 'react';
import type { MenuCatalogItem } from '@qauto/shared-types';

interface ModifierSheetProps {
  item: MenuCatalogItem;
  onClose: () => void;
  onAdd: (payload: { sizeId?: string; modifierIds: string[]; notes?: string }) => void;
}

export function ModifierSheet({ item, onClose, onAdd }: ModifierSheetProps) {
  const defaultSize = item.sizes.find((s) => s.isDefault) ?? item.sizes[0];
  const [sizeId, setSizeId] = useState(defaultSize?.id);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>(() => {
    const requiredGroup = item.modifierGroups.find((g) => g.isRequired);
    const firstMod = requiredGroup?.modifiers[0];
    return firstMod ? [firstMod.id] : [];
  });
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const requiredGroup = item.modifierGroups.find((g) => g.isRequired);
    const firstMod = requiredGroup?.modifiers[0];
    setSizeId((item.sizes.find((s) => s.isDefault) ?? item.sizes[0])?.id);
    setSelectedModifiers(firstMod ? [firstMod.id] : []);
    setNotes('');
  }, [item]);

  function toggleModifier(groupId: string, modifierId: string, maxSelections: number) {
    setSelectedModifiers((prev) => {
      const group = item.modifierGroups.find((g) => g.id === groupId);
      if (!group) return prev;

      const groupModIds = group.modifiers.map((m) => m.id);
      const currentInGroup = prev.filter((id) => groupModIds.includes(id));

      if (currentInGroup.includes(modifierId)) {
        return prev.filter((id) => id !== modifierId);
      }

      if (maxSelections === 1) {
        return [...prev.filter((id) => !groupModIds.includes(id)), modifierId];
      }

      if (currentInGroup.length >= maxSelections) {
        return prev;
      }

      return [...prev, modifierId];
    });
  }

  function handleAdd() {
    onAdd({
      sizeId: item.type === 'DRINK' ? sizeId : undefined,
      modifierIds: selectedModifiers,
      notes: notes || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-espresso">{item.name}</h3>
            <p className="text-sm text-stone-500">{item.type === 'DRINK' ? 'Customize drink' : 'Add snack'}</p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        {item.type === 'DRINK' && item.sizes.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium">Size</p>
            <div className="flex flex-wrap gap-2">
              {item.sizes.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setSizeId(size.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    sizeId === size.id ? 'bg-espresso text-white' : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {item.modifierGroups.map((group) => (
          <div key={group.id} className="mb-4">
            <p className="mb-2 text-sm font-medium">
              {group.name}
              {group.isRequired && <span className="text-red-500"> *</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.modifiers.map((mod) => {
                const active = selectedModifiers.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModifier(group.id, mod.id, group.maxSelections)}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      active ? 'bg-amber-brand text-espresso' : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {mod.name}
                    {parseFloat(mod.priceAdjustment) > 0 && (
                      <span className="ml-1 text-xs">+{mod.priceAdjustment}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <label className="mb-4 block text-sm font-medium">
          Notes
          <input
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Extra hot, less ice…"
          />
        </label>

        <button
          type="button"
          onClick={handleAdd}
          className="w-full rounded-xl bg-espresso py-3 font-semibold text-white hover:bg-stone-800"
        >
          Add to order
        </button>
      </div>
    </div>
  );
}
