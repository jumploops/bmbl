/**
 * Check if a URL should be captured (http/https only)
 */
export function isCapturableUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize a URL for deduplication
 * - Lowercase hostname
 * - Remove fragment (hash)
 * - Keep query string (V1)
 * - Remove trailing slash (except for root)
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Lowercase hostname
    const hostname = parsed.hostname.toLowerCase();

    // Get pathname, remove trailing slash if not root
    let pathname = parsed.pathname;
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Keep search (query string), remove hash
    const search = parsed.search;

    // Recompose
    return `${parsed.protocol}//${hostname}${pathname}${search}`;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Extract display domain from URL
 * - Strip www.
 * - Return hostname only (no path)
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();

    // Strip www.
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    return hostname;
  } catch {
    return url;
  }
}

/**
 * Generate a title fallback when title is missing
 */
export function generateTitleFallback(url: string): string {
  try {
    const parsed = new URL(url);
    const domain = extractDomain(url);
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${domain}${pathname}`;
  } catch {
    return url;
  }
}

/**
 * Validate a favicon URL for safe rendering
 * - Allows http/https URLs
 * - Allows data:image/* URLs up to 64KB
 * - Rejects all other schemes
 */
const MAX_DATA_URL_LENGTH = 65536; // 64KB

export function isValidFaviconUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  // Check for data URLs
  if (url.startsWith('data:')) {
    // Must be an image type and within size limit
    return url.startsWith('data:image/') && url.length <= MAX_DATA_URL_LENGTH;
  }

  // Check for http/https
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
