import { isCapturableUrl } from '@/lib/utils/url';

/**
 * Parsed bookmark from Netscape HTML format
 */
export interface ParsedBookmark {
  url: string;
  title: string;
  addDate: number | null; // Timestamp in ms, null if not available
}

/**
 * Parse Netscape Bookmark HTML format
 * This is the standard format exported by Chrome, Firefox, Safari, Edge, etc.
 *
 * Format example:
 * <DL><p>
 *   <DT><A HREF="https://example.com" ADD_DATE="1704067200">Page Title</A>
 * </DL><p>
 */
export function parseNetscapeBookmarks(html: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = [];

  // Use DOMParser for reliable HTML parsing
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find all anchor tags with href attribute
  const links = doc.querySelectorAll('a[href]');

  links.forEach((link) => {
    const url = link.getAttribute('href');
    if (!url) return;

    // Only include capturable URLs (http/https)
    if (!isCapturableUrl(url)) return;

    const title = link.textContent?.trim() || '';

    // ADD_DATE is in seconds since Unix epoch
    const addDateStr = link.getAttribute('add_date');
    let addDate: number | null = null;
    if (addDateStr) {
      const seconds = parseInt(addDateStr, 10);
      if (!isNaN(seconds)) {
        // Convert seconds to milliseconds
        addDate = seconds * 1000;
      }
    }

    bookmarks.push({ url, title, addDate });
  });

  return bookmarks;
}

/**
 * Check if content looks like Netscape bookmark HTML
 */
export function isNetscapeBookmarkHtml(content: string): boolean {
  // Check for DOCTYPE or common bookmark HTML patterns
  const lowerContent = content.toLowerCase().slice(0, 1000); // Check first 1KB
  return (
    lowerContent.includes('<!doctype netscape-bookmark-file') ||
    lowerContent.includes('netscape-bookmark-file') ||
    (lowerContent.includes('<dl>') && lowerContent.includes('<a href='))
  );
}
