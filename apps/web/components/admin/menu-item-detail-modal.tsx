'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Input, useToast } from '@qauto/ui';
import { ConfirmDialog, Modal } from '@/components/admin/modal';
import { MenuItemImageField } from '@/components/admin/menu-item-image-field';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type MenuItem = {
  id: string;
  name: string;
  code: string;
  basePrice: string;
  categoryName: string;
  imageUrl?: string | null;
};
type Size = { id: string; name: string; code: string; isDefault: boolean; priceAdjustment: string };
type ModifierGroup = { id: string; name: string };

type Props = {
  item: MenuItem | null;
  modifierGroups: ModifierGroup[];
  onClose: () => void;
  onUpdated: () => void;
};

export function MenuItemDetailModal({ item, modifierGroups, onClose, onUpdated }: Props) {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [sizes, setSizes] = useState<Size[]>([]);
  const [linkedGroups, setLinkedGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sizeForm, setSizeForm] = useState({ name: '', code: '', priceAdjustment: '0' });
  const [editForm, setEditForm] = useState({ name: '', basePrice: '', description: '', isActive: true, priceOverride: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [clearedImage, setClearedImage] = useState(false);
  const [deleteSize, setDeleteSize] = useState<Size | null>(null);

  const load = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const sizeList = await client.listMenuItemSizes(item.id);
      setSizes(sizeList as Size[]);
      setEditForm({
        name: item.name,
        basePrice: item.basePrice,
        description: '',
        isActive: true,
        priceOverride: '',
      });
      setImageFile(null);
      setClearedImage(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load item details', 'error');
    } finally {
      setLoading(false);
    }
  }, [item, toast]);

  useEffect(() => {
    if (item) load();
  }, [item, load]);

  async function saveItem() {
    if (!item) return;
    setSubmitting(true);
    try {
      const client = getApiClient();
      const patch: {
        name: string;
        basePrice: string;
        isActive: boolean;
        imageUrl?: string;
      } = {
        name: editForm.name,
        basePrice: editForm.basePrice,
        isActive: editForm.isActive,
      };

      if (imageFile) {
        const uploaded = await client.uploadMenuItemImage(imageFile);
        patch.imageUrl = uploaded.url;
      } else if (clearedImage) {
        patch.imageUrl = '';
      }

      await client.updateMenuItem(item.id, patch);
      if (branchId && editForm.priceOverride) {
        await client.setMenuItemPriceOverride(item.id, {
          branchId,
          priceOverride: editForm.priceOverride,
        });
      }
      toast('Menu item updated', 'success');
      onUpdated();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function addSize(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSubmitting(true);
    try {
      await getApiClient().createMenuItemSize(item.id, {
        name: sizeForm.name,
        code: sizeForm.code,
        priceAdjustment: sizeForm.priceAdjustment || '0',
        isDefault: sizes.length === 0,
      });
      toast('Size added', 'success');
      setSizeForm({ name: '', code: '', priceAdjustment: '0' });
      load();
      onUpdated();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteSize() {
    if (!item || !deleteSize) return;
    setSubmitting(true);
    try {
      await getApiClient().deleteMenuItemSize(item.id, deleteSize.id);
      toast('Size removed', 'success');
      setDeleteSize(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function linkGroup(groupId: string) {
    if (!item || linkedGroups.includes(groupId)) return;
    setSubmitting(true);
    try {
      await getApiClient().linkMenuItemModifierGroup(item.id, { modifierGroupId: groupId });
      setLinkedGroups((g) => [...g, groupId]);
      toast('Modifier group linked', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Link failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        open={!!item}
        title={item ? `Manage — ${item.name}` : 'Menu item'}
        wide
        onClose={onClose}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="primary" loading={submitting} onClick={saveItem}>Save item</Button>
          </>
        }
      >
        {loading ? <p className="text-sm text-ink-muted">Loading…</p> : (
          <div className="space-y-6">
            <MenuItemImageField
              currentImageUrl={clearedImage ? null : item?.imageUrl}
              file={imageFile}
              disabled={submitting}
              onClearCurrent={() => setClearedImage(true)}
              onFileChange={(file) => {
                setImageFile(file);
                if (file) setClearedImage(false);
              }}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="Base price (QAR)" value={editForm.basePrice} onChange={(e) => setEditForm((f) => ({ ...f, basePrice: e.target.value }))} />
              {branchId ? (
                <Input label="Branch price override (QAR)" value={editForm.priceOverride} onChange={(e) => setEditForm((f) => ({ ...f, priceOverride: e.target.value }))} />
              ) : null}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-border" />
                <span>Active</span>
              </label>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Sizes</h3>
              {sizes.length === 0 ? <p className="mb-2 text-sm text-ink-muted">No sizes — add Standard for recipes.</p> : (
                <ul className="mb-3 space-y-1 text-sm">
                  {sizes.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded border border-border/60 px-3 py-2">
                      <span>{s.name} ({s.code}) {s.isDefault ? <Badge variant="default">Default</Badge> : null}</span>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteSize(s)}>Remove</Button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={addSize} className="flex flex-wrap items-end gap-2">
                <Input label="Size name" value={sizeForm.name} onChange={(e) => setSizeForm((f) => ({ ...f, name: e.target.value }))} />
                <Input label="Code" value={sizeForm.code} onChange={(e) => setSizeForm((f) => ({ ...f, code: e.target.value }))} />
                <Input label="Price +/- QAR" value={sizeForm.priceAdjustment} onChange={(e) => setSizeForm((f) => ({ ...f, priceAdjustment: e.target.value }))} />
                <Button type="submit" variant="secondary" loading={submitting}>Add size</Button>
              </form>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Link modifier group</h3>
              <div className="flex flex-wrap gap-2">
                {modifierGroups.map((g) => (
                  <Button key={g.id} variant={linkedGroups.includes(g.id) ? 'primary' : 'secondary'} size="sm" disabled={linkedGroups.includes(g.id) || submitting} onClick={() => linkGroup(g.id)}>
                    {g.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!deleteSize} title="Remove size" message={`Remove size ${deleteSize?.name}?`} loading={submitting} onConfirm={confirmDeleteSize} onClose={() => setDeleteSize(null)} />
    </>
  );
}
