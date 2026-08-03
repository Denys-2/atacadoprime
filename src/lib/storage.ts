/**
 * Helpers for Supabase Storage URLs.
 */

/**
 * Append a cache-busting query parameter to a signed/public storage URL.
 * This forces browsers/CDN to fetch the latest version after an image is
 * re-uploaded.
 */
export function productImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.includes("?") ? `${url}&v=3` : `${url}?v=3`;
}
