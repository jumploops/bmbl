import Dexie from 'dexie';
import { db } from './schema';
import type { Item, ListOptions } from '@/types';
import { NOT_DELETED, NOT_FAVORITED, NOT_OPENED } from '@/types';
import { normalizeUrl, extractDomain, generateTitleFallback } from '@/lib/utils/url';
import { generateId } from '@/lib/utils/uuid';

/**
 * Create a new item from tab info
 * @param tabCount - Number of tabs with this URL (for relevance scoring)
 */
export function createItemFromTab(
  url: string,
  title: string | null,
  favIconUrl: string | null,
  tabCount: number = 1
): Omit<Item, 'itemId'> {
  const now = Date.now();
  const normalizedUrl = normalizeUrl(url);
  const domain = extractDomain(url);
  const displayTitle = title || generateTitleFallback(url);

  return {
    url,
    normalizedUrl,
    title: displayTitle,
    domain,
    favIconUrl,
    createdAt: now,
    lastSavedAt: now,
    saveCount: tabCount,
    favoritedAt: NOT_FAVORITED,
    deletedAt: NOT_DELETED,
    lastOpenedAt: NOT_OPENED,
    updatedAt: now,
  };
}

/**
 * Upsert an item (create or update based on normalizedUrl)
 * @param tabCount - Number of tabs with this URL (for relevance scoring)
 * Returns: { item, isNew, wasDeleted }
 */
export async function upsertItem(
  url: string,
  title: string | null,
  favIconUrl: string | null,
  tabCount: number = 1
): Promise<{ item: Item; isNew: boolean; wasDeleted: boolean }> {
  const normalizedUrl = normalizeUrl(url);

  const existing = await db.items
    .where('normalizedUrl')
    .equals(normalizedUrl)
    .first();

  if (!existing) {
    // Create new item
    const itemData = createItemFromTab(url, title, favIconUrl, tabCount);
    const item: Item = {
      itemId: generateId(),
      ...itemData,
    };
    await db.items.add(item);
    return { item, isNew: true, wasDeleted: false };
  }

  // Update existing item
  const now = Date.now();
  const wasDeleted = existing.deletedAt !== NOT_DELETED;
  const displayTitle = title || generateTitleFallback(url);

  const updates: Partial<Item> = {
    url, // Update to latest URL
    title: displayTitle,
    favIconUrl,
    lastSavedAt: now,
    saveCount: existing.saveCount + tabCount,
    updatedAt: now,
    // Keep deletedAt as-is (don't resurrect)
    // Keep favoritedAt as-is
  };

  await db.items.update(existing.itemId, updates);

  const updatedItem = { ...existing, ...updates };
  return { item: updatedItem, isNew: false, wasDeleted };
}

/**
 * List items for a view with efficient indexed queries.
 * Uses compound indexes to avoid loading all items into memory.
 */
export async function listItems(options: ListOptions): Promise<Item[]> {
  const { view, limit, offset } = options;

  switch (view) {
    case 'new':
      return listByLastSaved(limit, offset, 'desc');
    case 'old':
      return listByLastSaved(limit, offset, 'asc');
    case 'favorites':
      return listFavorites(limit, offset);
    case 'frequent':
      return listFrequent(limit, offset);
    case 'hidden':
      return listHidden(limit, offset);
  }
}

/**
 * List non-deleted items sorted by lastSavedAt.
 * Uses compound index [deletedAt+lastSavedAt] for efficient query.
 */
async function listByLastSaved(
  limit: number,
  offset: number,
  direction: 'asc' | 'desc'
): Promise<Item[]> {
  let query = db.items
    .where('[deletedAt+lastSavedAt]')
    .between(
      [NOT_DELETED, Dexie.minKey],
      [NOT_DELETED, Dexie.maxKey]
    );

  if (direction === 'desc') {
    query = query.reverse();
  }

  return query.offset(offset).limit(limit).toArray();
}

/**
 * List favorited items sorted by favoritedAt (most recent first).
 * Uses compound index [deletedAt+favoritedAt].
 * Secondary sort by lastSavedAt done in-memory (negligible for page size).
 */
async function listFavorites(limit: number, offset: number): Promise<Item[]> {
  // Get favorited items (favoritedAt > 0) that are not deleted
  const items = await db.items
    .where('[deletedAt+favoritedAt]')
    .between(
      [NOT_DELETED, 1],  // favoritedAt > 0 (excludes NOT_FAVORITED)
      [NOT_DELETED, Dexie.maxKey]
    )
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();

  // Secondary sort by lastSavedAt for items with same favoritedAt timestamp
  return items.sort((a, b) => {
    if (b.favoritedAt !== a.favoritedAt) return b.favoritedAt - a.favoritedAt;
    return b.lastSavedAt - a.lastSavedAt;
  });
}

/**
 * List non-deleted items sorted by saveCount (most saved first).
 * Uses compound index [deletedAt+saveCount].
 * Secondary sort by lastSavedAt done in-memory (negligible for page size).
 */
async function listFrequent(limit: number, offset: number): Promise<Item[]> {
  const items = await db.items
    .where('[deletedAt+saveCount]')
    .between(
      [NOT_DELETED, Dexie.minKey],
      [NOT_DELETED, Dexie.maxKey]
    )
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();

  // Secondary sort by lastSavedAt for items with same saveCount
  return items.sort((a, b) => {
    if (b.saveCount !== a.saveCount) return b.saveCount - a.saveCount;
    return b.lastSavedAt - a.lastSavedAt;
  });
}

/**
 * List deleted items sorted by deletedAt (most recent first).
 * Uses simple deletedAt index since we're filtering for deletedAt > 0.
 */
async function listHidden(limit: number, offset: number): Promise<Item[]> {
  return db.items
    .where('deletedAt')
    .above(NOT_DELETED)
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
}

/**
 * Get a single item by ID
 */
export async function getItem(itemId: string): Promise<Item | undefined> {
  return db.items.get(itemId);
}

/**
 * Add item to favorites
 */
export async function setFavorite(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    favoritedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Remove item from favorites
 */
export async function unsetFavorite(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    favoritedAt: NOT_FAVORITED,
    updatedAt: Date.now(),
  });
}

/**
 * Soft delete an item
 */
export async function softDelete(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Restore a soft-deleted item
 */
export async function restore(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    deletedAt: NOT_DELETED,
    updatedAt: Date.now(),
  });
}

/**
 * Get count of active (non-deleted) items.
 * Uses indexed query for efficiency.
 */
export async function getActiveItemCount(): Promise<number> {
  return db.items
    .where('[deletedAt+lastSavedAt]')
    .between([NOT_DELETED, Dexie.minKey], [NOT_DELETED, Dexie.maxKey])
    .count();
}

/**
 * Get total count of all items (including deleted).
 */
export async function getTotalItemCount(): Promise<number> {
  return db.items.count();
}
