'use client';

import { useEffect, useState } from 'react';
import type { MenuCatalogItem } from '@qauto/shared-types';
import { Button, Card, Input } from '@qauto/ui';

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

  function chipClass(active: boolean) {
    return `rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-brand text-brand-foreground shadow-soft'
        : 'border border-border bg-surface-sunken text-ink-secondary hover:bg-surface-raised'
    }`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <Card padding="lg" className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-soft-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-ink">{item.name}</h3>
            <p className="text-sm text-ink-muted">
              {item.type === 'DRINK' ? 'Customize your drink' : 'Add to order'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        {item.type === 'DRINK' && item.sizes.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-ink">Size</p>
            <div className="flex flex-wrap gap-2">
              {item.sizes.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setSizeId(size.id)}
                  className={chipClass(sizeId === size.id)}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {item.modifierGroups.map((group) => (
          <div key={group.id} className="mb-4">
            <p className="mb-2 text-sm font-medium text-ink">
              {group.name}
              {group.isRequired ? <span className="text-danger"> *</span> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.modifiers.map((mod) => {
                const active = selectedModifiers.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModifier(group.id, mod.id, group.maxSelections)}
                    className={chipClass(active)}
                  >
                    {mod.name}
                    {parseFloat(mod.priceAdjustment) > 0 ? (
                      <span className="ml-1 text-xs opacity-80">+{mod.priceAdjustment}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Extra hot, less ice…"
          className="mb-4"
        />

        <Button variant="primary" size="lg" className="w-full" onClick={handleAdd}>
          Add to order
        </Button>
      </Card>
    </div>
  );
}
