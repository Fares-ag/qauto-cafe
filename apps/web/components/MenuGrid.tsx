'use client';

import type { MenuCatalogItem } from '@qauto/shared-types';
import { Badge } from '@qauto/ui';
import { getCategoryIcon } from '@/lib/navigation';

interface MenuGridProps {
  items: MenuCatalogItem[];
  activeCategory: string;
  onSelectItem: (item: MenuCatalogItem) => void;
  disabled?: boolean;
}

function ItemImage({ item }: { item: MenuCatalogItem }) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-muted to-surface-sunken text-4xl">
      {item.type === 'DRINK' ? '☕' : '🥐'}
    </div>
  );
}

export function MenuGrid({ items, activeCategory, onSelectItem, disabled }: MenuGridProps) {
  const categoryIcon = getCategoryIcon(activeCategory);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-muted text-lg">
          {categoryIcon}
        </span>
        <h2 className="text-base font-semibold tracking-tight text-ink">{activeCategory}</h2>
        <span className="text-sm text-ink-muted">{items.length} items</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled || item.is86 || !item.isAvailable}
            onClick={() => onSelectItem(item)}
            className="group overflow-hidden rounded-xl border border-border bg-surface-raised text-left shadow-soft transition-all duration-150 hover:border-accent/40 hover:shadow-card active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="aspect-[4/3] overflow-hidden border-b border-border/60 bg-surface-sunken">
              <ItemImage item={item} />
            </div>
            <div className="px-3 py-3">
              <p className="font-semibold text-ink">{item.name}</p>
              <p className="mt-0.5 text-sm font-medium text-brand">{item.basePrice} QAR</p>
              {item.is86 ? (
                <Badge variant="danger" className="mt-2">
                  Sold out
                </Badge>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
