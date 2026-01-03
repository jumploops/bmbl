# Phase 2: Data Layer

**Goal**: Implement the complete data layer using Dexie.js, including schema, types, DAL operations, and URL utilities. This phase creates the foundation that both capture and UI will depend on.

**Dependencies**: Phase 1 (Project Setup)

**Estimated scope**: Medium

---

## Overview

This phase implements:
- Dexie.js database schema with all three stores
- TypeScript types for all entities
- Data Access Layer (DAL) with all CRUD operations
- URL normalization and filtering utilities
- Settings storage wrapper (chrome.storage.sync)
- Unit tests for core logic

---

## Implementation Steps

### 1. TypeScript Types

**src/types/index.ts**
```ts
// ============================================
// Database Entities
// ============================================

export interface Item {
  itemId: string;
  url: string;
  normalizedUrl: string;
  title: string;
  domain: string;
  favIconUrl: string | null;
  createdAt: number;
  lastSavedAt: number;
  saveCount: number;
  score: number;
  deletedAt: number | null;
  lastOpenedAt: number | null;
  updatedAt: number;
}

export interface Capture {
  captureId: string;
  createdAt: number;
  tabCountCaptured: number;
  tabCountSkippedInternal: number;
  tabCountUpdatedExisting: number;
  tabCountInsertedNew: number;
  tabCountAlreadyDeleted: number;
  autoCloseEnabled: boolean;
}

export interface CaptureEvent {
  captureId: string;
  itemId: string;
  capturedAt: number;
  windowId: number;
  tabId: number | null;
  pinned: boolean;
  groupId: number | null;
  groupTitle: string | null;
  groupColor: string | null;
}

// ============================================
// Views and Sorting
// ============================================

export type ViewType = 'new' | 'old' | 'priority' | 'frequent' | 'hidden';

export interface ListOptions {
  view: ViewType;
  limit: number;
  offset: number;
}

// ============================================
// Settings
// ============================================

export interface Settings {
  autoCloseAfterSave: boolean;
  resurfaceHiddenOnRecapture: boolean;
  defaultView: ViewType;
}

export const DEFAULT_SETTINGS: Settings = {
  autoCloseAfterSave: false,
  resurfaceHiddenOnRecapture: false,
  defaultView: 'new',
};

// ============================================
// Tab Info (from Chrome API)
// ============================================

export interface TabInfo {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl: string | null;
  pinned: boolean;
  groupId: number;
}

export interface TabGroupInfo {
  groupId: number;
  title: string | null;
  color: string | null;
}

// ============================================
// Capture Results
// ============================================

export interface CaptureResult {
  captureId: string;
  tabCountCaptured: number;
  tabCountSkippedInternal: number;
  tabCountUpdatedExisting: number;
  tabCountInsertedNew: number;
  tabCountAlreadyDeleted: number;
}
```

### 2. Dexie.js Database Schema

**src/lib/db/schema.ts**
```ts
import Dexie, { type Table } from 'dexie';
import type { Item, Capture, CaptureEvent } from '@/types';

export class BmblDatabase extends Dexie {
  items!: Table<Item, string>;
  captures!: Table<Capture, string>;
  captureEvents!: Table<CaptureEvent, [string, string]>;

  constructor() {
    super('bmbl');

    this.version(1).stores({
      // Primary key is itemId, indexes on other fields
      items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',

      // Primary key is captureId
      captures: 'captureId, createdAt',

      // Compound primary key [captureId, itemId]
      captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
    });
  }
}

// Singleton database instance
export const db = new BmblDatabase();
```

### 3. URL Utilities

**src/lib/utils/url.ts**
```ts
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
```

### 4. UUID Generator

**src/lib/utils/uuid.ts**
```ts
/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}
```

### 5. Data Access Layer - Items

**src/lib/db/items.ts**
```ts
import { db } from './schema';
import type { Item, ListOptions, ViewType } from '@/types';
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
export async function listItems(options: ListOptions): Promise<Item[]> {
  const { view, limit, offset } = options;

  let collection;

  switch (view) {
    case 'new':
      // Not deleted, sorted by lastSavedAt desc
      collection = db.items
        .where('deletedAt')
        .equals(null as any) // Dexie quirk for null comparison
        .reverse()
        .sortBy('lastSavedAt');
      break;

    case 'old':
      // Not deleted, sorted by lastSavedAt asc
      collection = db.items
        .where('deletedAt')
        .equals(null as any)
        .sortBy('lastSavedAt');
      break;

    case 'priority':
      // Not deleted AND score > 0, sorted by score desc
      collection = db.items
        .where('deletedAt')
        .equals(null as any)
        .and(item => item.score > 0)
        .reverse()
        .sortBy('score');
      break;

    case 'frequent':
      // Not deleted, sorted by saveCount desc
      collection = db.items
        .where('deletedAt')
        .equals(null as any)
        .reverse()
        .sortBy('saveCount');
      break;

    case 'hidden':
      // Deleted, sorted by deletedAt desc
      collection = db.items
        .where('deletedAt')
        .notEqual(null as any)
        .reverse()
        .sortBy('deletedAt');
      break;

    default:
      throw new Error(`Unknown view: ${view}`);
  }

  // Note: Dexie's sortBy returns a promise, we need to handle pagination differently
  const allItems = await collection;
  return allItems.slice(offset, offset + limit);
}

/**
 * Alternative list implementation using toArray() for better control
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
  return db.items.where('deletedAt').equals(null as any).count();
}
```

### 6. Data Access Layer - Captures

**src/lib/db/captures.ts**
```ts
import { db } from './schema';
import type { Capture, CaptureEvent, CaptureResult } from '@/types';
import { generateId } from '@/lib/utils/uuid';

/**
 * Create a new capture record
 */
export async function createCapture(
  stats: Omit<Capture, 'captureId' | 'createdAt'>
): Promise<string> {
  const captureId = generateId();
  const capture: Capture = {
    captureId,
    createdAt: Date.now(),
    ...stats,
  };
  await db.captures.add(capture);
  return captureId;
}

/**
 * Insert a capture event
 */
export async function insertCaptureEvent(event: CaptureEvent): Promise<void> {
  await db.captureEvents.add(event);
}

/**
 * Get the most recent capture
 */
export async function getLastCapture(): Promise<Capture | undefined> {
  return db.captures
    .orderBy('createdAt')
    .reverse()
    .first();
}

/**
 * Get all captures (for history view, future feature)
 */
export async function listCaptures(limit = 50, offset = 0): Promise<Capture[]> {
  return db.captures
    .orderBy('createdAt')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
}

/**
 * Get capture events for a specific capture
 */
export async function getCaptureEvents(captureId: string): Promise<CaptureEvent[]> {
  return db.captureEvents
    .where('captureId')
    .equals(captureId)
    .toArray();
}
```

### 7. Data Access Layer - Index

**src/lib/db/index.ts**
```ts
export { db, BmblDatabase } from './schema';
export * from './items';
export * from './captures';
```

### 8. Settings Storage

**src/lib/settings.ts**
```ts
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

const SETTINGS_KEY = 'settings';

/**
 * Get all settings
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

/**
 * Update settings (partial)
 */
export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const newSettings = { ...current, ...updates };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: newSettings });
}

/**
 * Initialize settings on install
 */
export async function initializeSettings(): Promise<void> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  if (!result[SETTINGS_KEY]) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
}

/**
 * Listen for settings changes
 */
export function onSettingsChange(callback: (settings: Settings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[SETTINGS_KEY]) {
      callback({ ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].newValue });
    }
  };

  chrome.storage.sync.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => chrome.storage.sync.onChanged.removeListener(listener);
}
```

### 9. Unit Tests

**src/lib/utils/url.test.ts**
```ts
import { describe, it, expect } from 'vitest';
import { isCapturableUrl, normalizeUrl, extractDomain, generateTitleFallback } from './url';

describe('isCapturableUrl', () => {
  it('allows http URLs', () => {
    expect(isCapturableUrl('http://example.com')).toBe(true);
  });

  it('allows https URLs', () => {
    expect(isCapturableUrl('https://example.com')).toBe(true);
  });

  it('rejects chrome:// URLs', () => {
    expect(isCapturableUrl('chrome://extensions')).toBe(false);
  });

  it('rejects chrome-extension:// URLs', () => {
    expect(isCapturableUrl('chrome-extension://abc123/page.html')).toBe(false);
  });

  it('rejects file:// URLs', () => {
    expect(isCapturableUrl('file:///home/user/doc.html')).toBe(false);
  });

  it('rejects about: URLs', () => {
    expect(isCapturableUrl('about:blank')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isCapturableUrl('')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isCapturableUrl('not a url')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('lowercases hostname', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/path')).toBe('https://example.com/path');
  });

  it('removes fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('keeps query string', () => {
    expect(normalizeUrl('https://example.com/page?foo=bar')).toBe('https://example.com/page?foo=bar');
  });

  it('removes trailing slash (non-root)', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('keeps trailing slash for root', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('handles complex URLs', () => {
    const url = 'https://WWW.Example.COM/Path/To/Page?query=1#hash';
    expect(normalizeUrl(url)).toBe('https://www.example.com/Path/To/Page?query=1');
  });
});

describe('extractDomain', () => {
  it('extracts domain from URL', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
  });

  it('strips www prefix', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('example.com');
  });

  it('lowercases domain', () => {
    expect(extractDomain('https://EXAMPLE.COM/path')).toBe('example.com');
  });

  it('handles subdomains', () => {
    expect(extractDomain('https://blog.example.com/path')).toBe('blog.example.com');
  });
});

describe('generateTitleFallback', () => {
  it('generates domain + path', () => {
    expect(generateTitleFallback('https://example.com/page')).toBe('example.com/page');
  });

  it('handles root path', () => {
    expect(generateTitleFallback('https://example.com/')).toBe('example.com');
  });

  it('strips www', () => {
    expect(generateTitleFallback('https://www.example.com/page')).toBe('example.com/page');
  });
});
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/index.ts` | All TypeScript interfaces |
| `src/lib/db/schema.ts` | Dexie.js database class |
| `src/lib/db/items.ts` | Item CRUD operations |
| `src/lib/db/captures.ts` | Capture CRUD operations |
| `src/lib/db/index.ts` | DAL exports |
| `src/lib/utils/url.ts` | URL normalization utilities |
| `src/lib/utils/uuid.ts` | UUID generator |
| `src/lib/settings.ts` | Settings storage wrapper |
| `src/lib/utils/url.test.ts` | URL utility tests |

---

## Acceptance Criteria

- [ ] All TypeScript types compile without errors
- [ ] Database initializes on first access (auto-create)
- [ ] `upsertItem` creates new items correctly
- [ ] `upsertItem` updates existing items (increments saveCount)
- [ ] `upsertItem` does not resurrect deleted items
- [ ] `listItems` returns correct items for each view
- [ ] `listItems` pagination works (offset/limit)
- [ ] Score operations work (increment, decrement, set)
- [ ] Soft delete and restore work
- [ ] URL normalization handles all edge cases
- [ ] URL filtering correctly identifies capturable URLs
- [ ] Settings storage reads/writes work
- [ ] All unit tests pass

---

## Testing

### Unit Tests
```bash
npm test -- src/lib/utils/url.test.ts
```

### Manual Testing (in browser console)
```js
// Test database operations
import { db, upsertItem, listItemsV2 } from '@/lib/db';

// Create an item
const result = await upsertItem('https://example.com', 'Example', null);
console.log(result); // { item: {...}, isNew: true, wasDeleted: false }

// List items
const items = await listItemsV2({ view: 'new', limit: 30, offset: 0 });
console.log(items);

// Check settings
import { getSettings } from '@/lib/settings';
const settings = await getSettings();
console.log(settings);
```

---

## Notes

- Dexie.js v4 handles IndexedDB versioning automatically
- Compound key for captureEvents prevents duplicate entries
- Settings use chrome.storage.sync for future cross-device sync
- URL normalization keeps query strings in V1 (utm stripping is V1.1)

---

## Next Phase

Once this phase is complete, proceed to **Phase 3: Capture Pipeline** to implement the tab capture logic.
