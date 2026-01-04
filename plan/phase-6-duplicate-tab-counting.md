# Phase 6: Duplicate Tab Counting & Relevance Scoring

**Goal**: Fix the duplicate URL capture error and implement proper tab counting where multiple tabs with the same URL increase the item's relevance score.

**Dependencies**: Phases 1-4 (existing implementation)

**Related Documents**:
- `debug/001-duplicate-url-capture-error.md` - Bug analysis
- `design/001-duplicate-tab-counting.md` - Design document

---

## Overview

This phase implements:
- Tab aggregation by normalized URL before processing
- `tabCount` field on CaptureEvent to track tabs per URL per capture
- `saveCount` increments by tabCount (not always +1)
- Metadata resolution: first tab's data, with fallbacks for missing fields
- Database schema migration (version 1 → 2)
- Updated capture statistics

---

## Summary of Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/types/index.ts` | Modify | Update CaptureEvent, Capture, add AggregatedTab |
| `src/lib/db/schema.ts` | Modify | Add version 2 migration |
| `src/lib/db/items.ts` | Modify | Update upsertItem to accept tabCount |
| `src/lib/db/captures.ts` | Modify | Update insertCaptureEvent signature |
| `src/lib/capture/tabs.ts` | Modify | Add aggregateTabsByUrl function |
| `src/lib/capture/capture.ts` | Modify | Use aggregation in capture flow |

---

## Implementation Steps

### Step 1: Update TypeScript Types

**File**: `src/types/index.ts`

#### 1.1 Update CaptureEvent Interface

```typescript
export interface CaptureEvent {
  captureId: string;
  itemId: string;
  capturedAt: number;

  // NEW: Count of tabs with this URL in this capture
  tabCount: number;

  // CHANGED: Array of window IDs where URL appeared
  windowIds: number[];

  // CHANGED: Array of tab IDs (for debugging/analytics)
  tabIds: (number | null)[];

  // CHANGED: True if ANY tab with this URL was pinned
  pinnedAny: boolean;

  // Group info (from first tab in a group, if any)
  groupId: number | null;
  groupTitle: string | null;
  groupColor: string | null;
}
```

#### 1.2 Update Capture Interface

```typescript
export interface Capture {
  captureId: string;
  createdAt: number;
  tabCountCaptured: number;
  tabCountSkippedInternal: number;
  tabCountUpdatedExisting: number;
  tabCountInsertedNew: number;
  tabCountAlreadyDeleted: number;
  autoCloseEnabled: boolean;

  // NEW: Count of unique URLs (after deduplication)
  uniqueUrlCount: number;
}
```

#### 1.3 Add AggregatedTab Interface

```typescript
/**
 * Tabs aggregated by normalized URL for a single capture
 */
export interface AggregatedTab {
  normalizedUrl: string;
  url: string;                    // Representative URL (first tab)
  title: string;                  // Best available title
  favIconUrl: string | null;      // Best available favicon
  tabs: TabInfo[];                // All tabs with this URL
  windowIds: number[];
  tabIds: (number | null)[];
  pinnedAny: boolean;
  groupId: number | null;
  groupTitle: string | null;
  groupColor: string | null;
}
```

---

### Step 2: Database Schema Migration

**File**: `src/lib/db/schema.ts`

#### 2.1 Add Version 2 Migration

The schema definition string stays the same (Dexie doesn't track field types, only indexes). We add an upgrade function to migrate existing data:

```typescript
import Dexie, { type Table } from 'dexie';
import type { Item, Capture, CaptureEvent } from '@/types';

export class BmblDatabase extends Dexie {
  items!: Table<Item, string>;
  captures!: Table<Capture, string>;
  captureEvents!: Table<CaptureEvent, [string, string]>;

  constructor() {
    super('bmbl');

    // Version 1: Original schema
    this.version(1).stores({
      items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',
      captures: 'captureId, createdAt',
      captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
    });

    // Version 2: Add tabCount, convert single values to arrays
    this.version(2).stores({
      // Schema strings unchanged - Dexie only cares about indexes
      items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',
      captures: 'captureId, createdAt',
      captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
    }).upgrade(tx => {
      // Migrate CaptureEvents
      return tx.table('captureEvents').toCollection().modify(event => {
        // Add tabCount if missing
        if (event.tabCount === undefined) {
          event.tabCount = 1;
        }

        // Convert windowId to windowIds array
        if (!Array.isArray(event.windowIds)) {
          event.windowIds = event.windowId !== undefined ? [event.windowId] : [];
          delete event.windowId;
        }

        // Convert tabId to tabIds array
        if (!Array.isArray(event.tabIds)) {
          event.tabIds = event.tabId !== undefined ? [event.tabId] : [];
          delete event.tabId;
        }

        // Rename pinned to pinnedAny
        if (event.pinnedAny === undefined) {
          event.pinnedAny = event.pinned ?? false;
          delete event.pinned;
        }
      });
    });
  }
}

export const db = new BmblDatabase();
```

---

### Step 3: Update Items DAL

**File**: `src/lib/db/items.ts`

#### 3.1 Update upsertItem to Accept tabCount

```typescript
/**
 * Upsert an item (create or update based on normalizedUrl)
 * @param tabCount - Number of tabs with this URL (for relevance scoring)
 * Returns: { item, isNew, wasDeleted }
 */
export async function upsertItem(
  url: string,
  title: string | null,
  favIconUrl: string | null,
  tabCount: number = 1  // NEW parameter with default
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
  const wasDeleted = existing.deletedAt !== null;
  const displayTitle = title || generateTitleFallback(url);

  const updates: Partial<Item> = {
    url,
    title: displayTitle,
    favIconUrl,
    lastSavedAt: now,
    saveCount: existing.saveCount + tabCount,  // INCREMENT BY tabCount
    updatedAt: now,
  };

  await db.items.update(existing.itemId, updates);

  const updatedItem = { ...existing, ...updates };
  return { item: updatedItem, isNew: false, wasDeleted };
}
```

#### 3.2 Update createItemFromTab

```typescript
export function createItemFromTab(
  url: string,
  title: string | null,
  favIconUrl: string | null,
  tabCount: number = 1  // NEW parameter
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
    saveCount: tabCount,  // USE tabCount instead of 1
    score: 1,
    deletedAt: null,
    lastOpenedAt: null,
    updatedAt: now,
  };
}
```

---

### Step 4: Update Captures DAL

**File**: `src/lib/db/captures.ts`

#### 4.1 Update insertCaptureEvent (No Signature Change Needed)

The function already accepts a `CaptureEvent` object, so it will automatically work with the new fields. No changes needed to the function itself, but callers must provide the new shape.

#### 4.2 Update createCapture Type

Ensure the `Capture` type now includes `uniqueUrlCount`. The function already uses `Omit<Capture, 'captureId' | 'createdAt'>`, so callers will need to provide it.

---

### Step 5: Add Tab Aggregation Logic

**File**: `src/lib/capture/tabs.ts`

#### 5.1 Add aggregateTabsByUrl Function

```typescript
import type { TabInfo, TabGroupInfo, AggregatedTab } from '@/types';
import { normalizeUrl } from '@/lib/utils/url';

/**
 * Aggregate tabs by normalized URL
 *
 * Metadata resolution strategy:
 * - Use first tab's data as default
 * - If title is empty, use first tab that has a title
 * - If favicon is null, use first tab that has a favicon
 * - Group info from first tab that's in a group
 */
export function aggregateTabsByUrl(
  capturableTabs: TabInfo[],
  groupMap: Map<number, TabGroupInfo>
): AggregatedTab[] {
  const aggregatedMap = new Map<string, AggregatedTab>();

  for (const tab of capturableTabs) {
    const normalized = normalizeUrl(tab.url);

    if (!aggregatedMap.has(normalized)) {
      // First tab with this URL - initialize aggregation
      const groupInfo = tab.groupId !== -1 ? groupMap.get(tab.groupId) : undefined;

      aggregatedMap.set(normalized, {
        normalizedUrl: normalized,
        url: tab.url,
        title: tab.title || '',
        favIconUrl: tab.favIconUrl,
        tabs: [tab],
        windowIds: [tab.windowId],
        tabIds: [tab.tabId],
        pinnedAny: tab.pinned,
        groupId: groupInfo?.groupId ?? null,
        groupTitle: groupInfo?.title ?? null,
        groupColor: groupInfo?.color ?? null,
      });
    } else {
      // Additional tab with same URL - merge data
      const existing = aggregatedMap.get(normalized)!;
      existing.tabs.push(tab);
      existing.windowIds.push(tab.windowId);
      existing.tabIds.push(tab.tabId);

      // Update pinnedAny if this tab is pinned
      if (tab.pinned) {
        existing.pinnedAny = true;
      }

      // Fill in missing title from this tab
      if (!existing.title && tab.title) {
        existing.title = tab.title;
      }

      // Fill in missing favicon from this tab
      if (!existing.favIconUrl && tab.favIconUrl) {
        existing.favIconUrl = tab.favIconUrl;
      }

      // Fill in missing group info from this tab
      if (existing.groupId === null && tab.groupId !== -1) {
        const groupInfo = groupMap.get(tab.groupId);
        if (groupInfo) {
          existing.groupId = groupInfo.groupId;
          existing.groupTitle = groupInfo.title;
          existing.groupColor = groupInfo.color;
        }
      }
    }
  }

  return Array.from(aggregatedMap.values());
}
```

#### 5.2 Update Exports in index.ts

**File**: `src/lib/capture/index.ts`

```typescript
export { captureAllTabs, isCaptureInProgress } from './capture';
export { setIconState, resetIcon } from './icons';
export {
  queryAllTabs,
  queryAllTabGroups,
  buildGroupMap,
  filterAndTransformTabs,
  closeTabsExcludingPinned,
  aggregateTabsByUrl,  // NEW
} from './tabs';
```

---

### Step 6: Update Capture Pipeline

**File**: `src/lib/capture/capture.ts`

#### 6.1 Refactor captureAllTabs to Use Aggregation

```typescript
import { db } from '@/lib/db/schema';
import { upsertItem } from '@/lib/db/items';
import { createCapture, insertCaptureEvent } from '@/lib/db/captures';
import { getSettings } from '@/lib/settings';
import { setIconState } from './icons';
import {
  queryAllTabs,
  queryAllTabGroups,
  buildGroupMap,
  filterAndTransformTabs,
  closeTabsExcludingPinned,
  aggregateTabsByUrl,
} from './tabs';
import type { CaptureResult, CaptureEvent } from '@/types';
import { generateId } from '@/lib/utils/uuid';

let captureInProgress = false;

export function isCaptureInProgress(): boolean {
  return captureInProgress;
}

export async function captureAllTabs(): Promise<CaptureResult> {
  if (captureInProgress) {
    throw new Error('Capture already in progress');
  }

  captureInProgress = true;

  try {
    await setIconState('loading');

    const settings = await getSettings();

    const [allTabs, allGroups] = await Promise.all([
      queryAllTabs(),
      queryAllTabGroups(),
    ]);

    const groupMap = buildGroupMap(allGroups);
    const { capturableTabs, skippedCount } = filterAndTransformTabs(allTabs, groupMap);

    // NEW: Aggregate tabs by URL
    const aggregatedTabs = aggregateTabsByUrl(capturableTabs, groupMap);

    // Prepare capture stats
    let tabCountUpdatedExisting = 0;
    let tabCountInsertedNew = 0;
    let tabCountAlreadyDeleted = 0;

    const captureId = generateId();
    const capturedAt = Date.now();

    await db.transaction('rw', [db.items, db.captures, db.captureEvents], async () => {
      // Process each UNIQUE URL (not each tab)
      for (const aggregated of aggregatedTabs) {
        const tabCount = aggregated.tabs.length;

        const { item, isNew, wasDeleted } = await upsertItem(
          aggregated.url,
          aggregated.title || null,
          aggregated.favIconUrl,
          tabCount  // Pass tab count
        );

        // Track stats based on unique URLs, but count tabs
        if (isNew) {
          tabCountInsertedNew += tabCount;
        } else if (wasDeleted) {
          tabCountAlreadyDeleted += tabCount;
        } else {
          tabCountUpdatedExisting += tabCount;
        }

        // Create ONE capture event per unique URL
        const event: CaptureEvent = {
          captureId,
          itemId: item.itemId,
          capturedAt,
          tabCount,
          windowIds: aggregated.windowIds,
          tabIds: aggregated.tabIds,
          pinnedAny: aggregated.pinnedAny,
          groupId: aggregated.groupId,
          groupTitle: aggregated.groupTitle,
          groupColor: aggregated.groupColor,
        };

        await insertCaptureEvent(event);
      }

      // Create capture record
      await createCapture({
        tabCountCaptured: capturableTabs.length,  // Total tabs
        tabCountSkippedInternal: skippedCount,
        tabCountUpdatedExisting,
        tabCountInsertedNew,
        tabCountAlreadyDeleted,
        autoCloseEnabled: settings.autoCloseAfterSave,
        uniqueUrlCount: aggregatedTabs.length,  // NEW: unique URLs
      });
    });

    // Auto-close tabs if enabled
    if (settings.autoCloseAfterSave) {
      await closeTabsExcludingPinned(capturableTabs);
    }

    await setIconState('success');

    return {
      captureId,
      tabCountCaptured: capturableTabs.length,
      tabCountSkippedInternal: skippedCount,
      tabCountUpdatedExisting,
      tabCountInsertedNew,
      tabCountAlreadyDeleted,
    };
  } finally {
    captureInProgress = false;
  }
}
```

---

### Step 7: Update CaptureResult Type (Optional Enhancement)

**File**: `src/types/index.ts`

Consider adding `uniqueUrlCount` to CaptureResult for UI feedback:

```typescript
export interface CaptureResult {
  captureId: string;
  tabCountCaptured: number;
  tabCountSkippedInternal: number;
  tabCountUpdatedExisting: number;
  tabCountInsertedNew: number;
  tabCountAlreadyDeleted: number;
  uniqueUrlCount?: number;  // NEW: optional for backward compat
}
```

---

## Files Changed Summary

| File | Action | Changes |
|------|--------|---------|
| `src/types/index.ts` | Modify | Update CaptureEvent, Capture, add AggregatedTab, update CaptureResult |
| `src/lib/db/schema.ts` | Modify | Add version 2 with upgrade migration |
| `src/lib/db/items.ts` | Modify | Add tabCount param to upsertItem and createItemFromTab |
| `src/lib/capture/tabs.ts` | Modify | Add aggregateTabsByUrl function |
| `src/lib/capture/capture.ts` | Modify | Use aggregation, pass tabCount, create proper CaptureEvent |
| `src/lib/capture/index.ts` | Modify | Export aggregateTabsByUrl |

---

## Testing Plan

### Unit Tests

Add to `src/lib/capture/tabs.test.ts`:

```typescript
describe('aggregateTabsByUrl', () => {
  it('aggregates tabs with same URL', () => {
    const tabs: TabInfo[] = [
      { tabId: 1, windowId: 1, url: 'https://reddit.com/', title: 'Reddit', favIconUrl: null, pinned: false, groupId: -1 },
      { tabId: 2, windowId: 2, url: 'https://reddit.com/', title: 'Reddit', favIconUrl: 'icon.png', pinned: true, groupId: -1 },
    ];
    const result = aggregateTabsByUrl(tabs, new Map());

    expect(result).toHaveLength(1);
    expect(result[0].tabs).toHaveLength(2);
    expect(result[0].tabCount).toBe(2);
    expect(result[0].pinnedAny).toBe(true);
    expect(result[0].favIconUrl).toBe('icon.png'); // Filled from second tab
  });

  it('fills missing title from subsequent tabs', () => {
    const tabs: TabInfo[] = [
      { tabId: 1, windowId: 1, url: 'https://example.com/', title: '', favIconUrl: null, pinned: false, groupId: -1 },
      { tabId: 2, windowId: 1, url: 'https://example.com/', title: 'Example Site', favIconUrl: null, pinned: false, groupId: -1 },
    ];
    const result = aggregateTabsByUrl(tabs, new Map());

    expect(result[0].title).toBe('Example Site');
  });

  it('keeps unique URLs separate', () => {
    const tabs: TabInfo[] = [
      { tabId: 1, windowId: 1, url: 'https://reddit.com/', title: 'Reddit', favIconUrl: null, pinned: false, groupId: -1 },
      { tabId: 2, windowId: 1, url: 'https://github.com/', title: 'GitHub', favIconUrl: null, pinned: false, groupId: -1 },
    ];
    const result = aggregateTabsByUrl(tabs, new Map());

    expect(result).toHaveLength(2);
  });
});
```

### Manual Testing Checklist

1. **Duplicate tabs in single capture**
   - Open reddit.com in 3 tabs
   - Capture
   - Verify: Item has `saveCount = 3`
   - Verify: CaptureEvent has `tabCount = 3`
   - Verify: No errors in console

2. **Subsequent capture with duplicates**
   - After test 1, open reddit.com in 2 more tabs
   - Capture
   - Verify: Item has `saveCount = 5`
   - Verify: NEW CaptureEvent has `tabCount = 2`

3. **Hidden item with duplicates**
   - Hide gmail.com
   - Open gmail.com in 4 tabs
   - Capture
   - Verify: Item `saveCount` increased by 4
   - Verify: Item still hidden
   - Verify: CaptureEvent has `tabCount = 4`

4. **Metadata fallback**
   - Open a URL with no title in one tab
   - Open same URL (with title) in another tab
   - Capture
   - Verify: Item has the non-empty title

5. **Migration**
   - With existing data from v1
   - Reload extension
   - Verify: Old CaptureEvents have `tabCount = 1`
   - Verify: Old CaptureEvents have `windowIds` array
   - Verify: No data loss

---

## Verification

After implementation:

```bash
pnpm typecheck   # Verify no type errors
pnpm build       # Verify build succeeds
pnpm test        # Verify tests pass
```

---

## Rollback Plan

If issues arise:
1. The migration is additive (new fields with defaults)
2. Old code would fail on new field shapes, but data is preserved
3. Can revert code and data still works (new fields ignored)

---

## Next Steps

After this phase:
1. Consider adding `tabCount` display in UI for "frequent" view
2. Consider capture summary toast: "Saved 10 tabs (7 unique URLs)"
3. Proceed to Phase 5 (Polish & Settings) if not yet complete
