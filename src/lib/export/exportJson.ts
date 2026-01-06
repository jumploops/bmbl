import { db } from '@/lib/db/schema';
import { NOT_DELETED } from '@/types';
import type { BmblExport, ExportOptions, ExportedItem } from './types';

/**
 * Export items to JSON format
 */
export async function exportToJson(options: ExportOptions): Promise<BmblExport> {
  // Query items based on options
  const items = options.includeHidden
    ? await db.items.toArray()
    : await db.items.where('deletedAt').equals(NOT_DELETED).toArray();

  // Get extension version safely
  let extensionVersion = '0.0.0';
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      extensionVersion = chrome.runtime.getManifest().version;
    }
  } catch {
    // Ignore - use default version
  }

  // Transform items to export format
  const exportedItems: ExportedItem[] = items.map((item) => ({
    url: item.url,
    title: item.title,
    domain: item.domain,
    favIconUrl: item.favIconUrl,
    createdAt: item.createdAt,
    lastSavedAt: item.lastSavedAt,
    saveCount: item.saveCount,
    // Only include favoritedAt if actually favorited
    ...(item.favoritedAt > 0 && { favoritedAt: item.favoritedAt }),
    // Only include deletedAt if deleted (and includeHidden is true)
    ...(item.deletedAt > 0 && { deletedAt: item.deletedAt }),
  }));

  const exportData: BmblExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: {
      extensionVersion,
      browser: 'chrome',
    },
    options: {
      includeHidden: options.includeHidden,
    },
    stats: {
      totalItems: items.length,
      favoriteCount: items.filter((i) => i.favoritedAt > 0).length,
      hiddenCount: items.filter((i) => i.deletedAt > 0).length,
    },
    items: exportedItems,
  };

  return exportData;
}

/**
 * Convert export data to a downloadable Blob
 */
export function exportToBlob(data: BmblExport): Blob {
  return new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
}

/**
 * Trigger a file download in the browser
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for the export
 */
export function generateExportFilename(): string {
  const date = new Date().toISOString().split('T')[0];
  return `bmbl-export-${date}.json`;
}
