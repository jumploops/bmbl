import { db } from '@/lib/db/schema';
import { normalizeUrl, extractDomain, isCapturableUrl } from '@/lib/utils/url';
import { generateId } from '@/lib/utils/uuid';
import { NOT_DELETED, NOT_FAVORITED, NOT_OPENED } from '@/types';
import type { BmblExport, ExportedItem } from '@/lib/export/types';
import type { ImportOptions, ImportResult } from './types';

/**
 * Import items from a validated BmblExport
 */
export async function importFromJson(
  data: BmblExport,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    merged: 0,
    errors: [],
  };

  const seenUrls = new Set<string>();

  try {
    await db.transaction('rw', db.items, async () => {
      for (const item of data.items) {
        // Skip invalid URLs
        if (!item.url || !isCapturableUrl(item.url)) {
          result.errors.push(`Skipped invalid URL: ${item.url}`);
          continue;
        }

        const normalizedUrl = normalizeUrl(item.url);

        // Skip duplicates within the import file
        if (seenUrls.has(normalizedUrl)) {
          continue;
        }
        seenUrls.add(normalizedUrl);

        // Check for existing item
        const existing = await db.items
          .where('normalizedUrl')
          .equals(normalizedUrl)
          .first();

        if (existing) {
          if (options.conflictStrategy === 'skip') {
            result.skipped++;
            continue;
          }

          // Merge strategy
          await mergeItem(existing.itemId, existing, item);
          result.merged++;
        } else {
          // Insert new item
          await insertItem(item, normalizedUrl);
          result.imported++;
        }
      }
    });

    result.success = true;
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : 'Unknown error during import'
    );
  }

  return result;
}

/**
 * Merge imported item data into existing item
 */
async function mergeItem(
  itemId: string,
  existing: { saveCount: number; lastSavedAt: number; createdAt: number; favoritedAt: number; deletedAt: number; favIconUrl: string | null },
  imported: ExportedItem
): Promise<void> {
  await db.items.update(itemId, {
    // Combine save counts
    saveCount: existing.saveCount + (imported.saveCount || 1),
    // Use most recent lastSavedAt
    lastSavedAt: Math.max(existing.lastSavedAt, imported.lastSavedAt || 0),
    // Use oldest createdAt
    createdAt: Math.min(existing.createdAt, imported.createdAt || Date.now()),
    // Keep favorited if either is favorited
    favoritedAt: existing.favoritedAt || imported.favoritedAt || NOT_FAVORITED,
    // Resurrect if imported is not deleted
    deletedAt: imported.deletedAt ? existing.deletedAt : NOT_DELETED,
    // Fill in favicon if existing has none
    favIconUrl: existing.favIconUrl || imported.favIconUrl || null,
    updatedAt: Date.now(),
  });
}

/**
 * Insert a new item from imported data
 */
async function insertItem(
  item: ExportedItem,
  normalizedUrl: string
): Promise<void> {
  const now = Date.now();
  const domain = item.domain || extractDomain(item.url);
  const title = item.title || domain;

  await db.items.add({
    itemId: generateId(),
    url: item.url,
    normalizedUrl,
    title,
    domain,
    favIconUrl: item.favIconUrl ?? null,
    createdAt: item.createdAt || now,
    lastSavedAt: item.lastSavedAt || now,
    saveCount: item.saveCount || 1,
    favoritedAt: item.favoritedAt || NOT_FAVORITED,
    deletedAt: item.deletedAt || NOT_DELETED,
    lastOpenedAt: NOT_OPENED,
    updatedAt: now,
  });
}
