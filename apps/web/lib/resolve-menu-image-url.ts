/** Resolve menu image URLs stored as relative API paths (legacy local uploads). */
export function resolveMenuImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
  if (imageUrl.startsWith('/')) {
    return `${base.replace(/\/api\/v1$/, '')}${imageUrl}`;
  }
  return imageUrl;
}
