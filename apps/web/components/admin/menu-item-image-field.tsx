'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@qauto/ui';

type Props = {
  label?: string;
  currentImageUrl?: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onClearCurrent?: () => void;
  disabled?: boolean;
};

export function MenuItemImageField({
  label = 'Image',
  currentImageUrl,
  file,
  onFileChange,
  onClearCurrent,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const displayUrl = previewUrl ?? currentImageUrl ?? null;

  return (
    <div className="space-y-2">
      <span className="block text-sm text-ink-muted">{label}</span>
      {displayUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-sunken">
          <img src={displayUrl} alt="Menu item preview" className="h-40 w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-surface-sunken text-sm text-ink-muted">
          No image selected
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={disabled}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {file || currentImageUrl ? 'Change image' : 'Upload image'}
        </Button>
        {file || currentImageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onFileChange(null);
              onClearCurrent?.();
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-ink-muted">JPEG, PNG, WebP, or GIF · max 5 MB</p>
    </div>
  );
}
