'use client';

type IngredientOption = {
  id: string;
  name: string;
  uom: string;
  purchaseUom?: string | null;
};

interface IngredientSelectProps {
  label?: string;
  ingredients: IngredientOption[];
  value: string;
  onChange: (ingredientId: string) => void;
  showUom?: boolean;
}

export function IngredientSelect({
  label = 'Ingredient',
  ingredients,
  value,
  onChange,
  showUom = true,
}: IngredientSelectProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-muted">{label}</span>
      <select
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {ingredients.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
            {showUom ? ` (${i.uom}${i.purchaseUom ? ` · buy in ${i.purchaseUom}` : ''})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

interface UomModeSelectProps {
  baseUom: string;
  purchaseUom?: string | null;
  purchaseUomId?: string | null;
  baseUomId: string;
  value: string;
  onChange: (uomId: string) => void;
}

export function UomModeSelect({
  baseUom,
  purchaseUom,
  purchaseUomId,
  baseUomId,
  value,
  onChange,
}: UomModeSelectProps) {
  if (!purchaseUomId || !purchaseUom) {
    return (
      <p className="text-xs text-ink-muted">
        Quantity in <span className="font-medium text-ink">{baseUom}</span>
      </p>
    );
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-muted">Count in</span>
      <select
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={baseUomId}>Stock unit ({baseUom})</option>
        <option value={purchaseUomId}>Purchase unit ({purchaseUom})</option>
      </select>
    </label>
  );
}
