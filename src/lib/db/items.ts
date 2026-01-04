import { db } from './schema';
import type { Item, ListOptions } from '@/types';
import { normalizeUrl, extractDomain, generateTitleFallback } from '@/lib/utils/url';
import { generateId } from '@/lib/utils/uuid';

/**
 * Create a new item from tab info
 */
export function createItemFromTab(
  url: string,
  title: string | null,
  favIconUrl: string | null
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
    saveCount: 1,
    score: 1, // Default score is 1
    deletedAt: null,
    lastOpenedAt: null,
    updatedAt: now,
  };
}

/**
 * Upsert an item (create or update based on normalizedUrl)
 * Returns: { item, isNew, wasDeleted }
 */
export async function upsertItem(
  url: string,
  title: string | null,
  favIconUrl: string | null
): Promise<{ item: Item; isNew: boolean; wasDeleted: boolean }> {
  const normalizedUrl = normalizeUrl(url);

  const existing = await db.items
    .where('normalizedUrl')
    .equals(normalizedUrl)
    .first();

  if (!existing) {
    // Create new item
    const itemData = createItemFromTab(url, title, favIconUrl);
    const item: Item = {
      itemId: generateId(),
      ...itemData,
    };
    await db.items.add(item);
    return { item, isNew: true, wasDeleted: false };
  }

  // Update existing item
  const now = Date.now();
  const wasDeleted = existing.deletedAt !== null;
  const displayTitle = title || generateTitleFallback(url);

  const updates: Partial<Item> = {
    url, // Update to latest URL
    title: displayTitle,
    favIconUrl,
    lastSavedAt: now,
    saveCount: existing.saveCount + 1,
    updatedAt: now,
    // Keep deletedAt as-is (don't resurrect)
    // Keep score as-is
  };

  await db.items.update(existing.itemId, updates);

  const updatedItem = { ...existing, ...updates };
  return { item: updatedItem, isNew: false, wasDeleted };
}

/**
 * Get items for a view with pagination
 */
export async function listItemsV2(options: ListOptions): Promise<Item[]> {
  const { view, limit, offset } = options;

  // Get all items first (Dexie limitation with complex sorting)
  let items = await db.items.toArray();

  // Filter based on view
  switch (view) {
    case 'new':
    case 'old':
    case 'frequent':
      items = items.filter(item => item.deletedAt === null);
      break;
    case 'priority':
      items = items.filter(item => item.deletedAt === null && item.score > 0);
      break;
    case 'hidden':
      items = items.filter(item => item.deletedAt !== null);
      break;
  }

  // Sort based on view
  switch (view) {
    case 'new':
      items.sort((a, b) => b.lastSavedAt - a.lastSavedAt);
      break;
    case 'old':
      items.sort((a, b) => a.lastSavedAt - b.lastSavedAt);
      break;
    case 'priority':
      items.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.lastSavedAt - a.lastSavedAt;
      });
      break;
    case 'frequent':
      items.sort((a, b) => {
        if (b.saveCount !== a.saveCount) return b.saveCount - a.saveCount;
        return b.lastSavedAt - a.lastSavedAt;
      });
      break;
    case 'hidden':
      items.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
      break;
  }

  // Paginate
  return items.slice(offset, offset + limit);
}

/**
 * Get a single item by ID
 */
export async function getItem(itemId: string): Promise<Item | undefined> {
  return db.items.get(itemId);
}

/**
 * Increment score by 1
 */
export async function incrementScore(itemId: string): Promise<void> {
  await db.items.where('itemId').equals(itemId).modify(item => {
    item.score += 1;
    item.updatedAt = Date.now();
  });
}

/**
 * Decrement score by 1 (min 0)
 */
export async function decrementScore(itemId: string): Promise<void> {
  await db.items.where('itemId').equals(itemId).modify(item => {
    item.score = Math.max(0, item.score - 1);
    item.updatedAt = Date.now();
  });
}

/**
 * Set score to a specific value
 */
export async function setScore(itemId: string, score: number): Promise<void> {
  await db.items.update(itemId, {
    score: Math.max(0, score),
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
    deletedAt: null,
    updatedAt: Date.now(),
  });
}

/**
 * Get total count of items (for stats)
 */
export async function getItemCount(includeDeleted = false): Promise<number> {
  if (includeDeleted) {
    return db.items.count();
  }
  const items = await db.items.toArray();
  return items.filter(item => item.deletedAt === null).length;
}
