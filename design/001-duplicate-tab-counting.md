# Design: Duplicate Tab Counting & Relevance Scoring

**Date**: 2026-01-04
**Status**: Draft
**Related**: `debug/001-duplicate-url-capture-error.md`

---

## Problem Statement

When capturing tabs, having the same URL open in multiple tabs/windows should **increase the relevance score** of that URL. Currently, the implementation throws an error because the `captureEvents` table uses `[captureId, itemId]` as its compound primary key, preventing multiple events for the same item in a single capture.

### Original Design Intent (from spec)

From `spec/init.md` (lines 380-382):
> `captureEvents` (join table: capture ↔ item)
> Key: compound `[captureId, itemId]` (prevents duplicates, ensures data integrity)

The original design assumed **one capture event per unique URL per capture**, which is correct. However, the implementation processes each tab individually without aggregating by URL first, causing the duplicate key error.

### New Insight

The user clarified that **multiple tabs with the same URL indicate higher relevance**:

1. If a user has 3 tabs of the same blog post open, that blog post is clearly important to them
2. Common URLs like gmail.com will naturally bubble up due to being frequently open
3. This helps users identify "noise" URLs they might want to hide
4. `saveCount` should reflect **total tab occurrences**, not just **capture events**

---

## Requirements

### Functional Requirements

1. **Tab counting**: When the same URL appears in N tabs within a single capture:
   - `saveCount` on the Item should increment by N (not 1)
   - One CaptureEvent should be created with `tabCount = N`

2. **Backward compatibility**: Existing data should continue to work (tabCount defaults to 1 for old events)

3. **No errors**: Capture should never fail due to duplicate URLs in open tabs

4. **Preserve metadata**: When multiple tabs have the same URL, capture should preserve representative metadata:
   - Use the most recently active tab's title (or first encountered)
   - Track all window IDs where the URL appeared
   - Note if any instance was pinned

### Non-Functional Requirements

1. **Atomicity**: Capture remains a single atomic transaction
2. **Performance**: Aggregation should not noticeably slow down capture
3. **Schema migration**: Handle existing data gracefully

---

## Current Architecture

### Data Flow (Current - Buggy)

```
1. Query all tabs
2. Filter to capturable URLs
3. FOR EACH tab:
   a. upsertItem(url) → increments saveCount by 1
   b. insertCaptureEvent(captureId, itemId) → FAILS on duplicate
```

### Schema (Current)

```typescript
// CaptureEvent (current)
interface CaptureEvent {
  captureId: string;
  itemId: string;
  capturedAt: number;
  windowId: number;        // Single window
  tabId: number | null;    // Single tab
  pinned: boolean;         // Single pinned state
  groupId: number | null;
  groupTitle: string | null;
  groupColor: string | null;
}

// Primary key: [captureId, itemId]
```

---

## Proposed Design

### Design Principle

**Aggregate tabs by normalized URL before processing**, then:
- Create/update Item with total tab count
- Create one CaptureEvent per unique URL with metadata about all tabs

### Schema Changes

#### CaptureEvent (Updated)

```typescript
interface CaptureEvent {
  captureId: string;
  itemId: string;
  capturedAt: number;

  // NEW: Count of tabs with this URL in this capture
  tabCount: number;  // Default: 1

  // Changed: Array of window IDs where URL appeared
  windowIds: number[];  // Was: windowId: number

  // Changed: Array of tab IDs (for debugging/analytics)
  tabIds: (number | null)[];  // Was: tabId: number | null

  // Changed: True if ANY tab was pinned
  pinnedAny: boolean;  // Was: pinned: boolean

  // Group info (from first tab in a group, if any)
  groupId: number | null;
  groupTitle: string | null;
  groupColor: string | null;
}
```

#### Item (No Changes)

The `Item` interface remains unchanged. The `saveCount` field will now increment by `tabCount` instead of always +1.

#### Capture (Updated Stats)

```typescript
interface Capture {
  captureId: string;
  createdAt: number;
  tabCountCaptured: number;      // Total tabs captured
  tabCountSkippedInternal: number;
  tabCountUpdatedExisting: number;
  tabCountInsertedNew: number;
  tabCountAlreadyDeleted: number;
  autoCloseEnabled: boolean;

  // NEW: Count of unique URLs (after deduplication)
  uniqueUrlCount: number;
}
```

### Algorithm: Tab Aggregation

```typescript
interface AggregatedTab {
  normalizedUrl: string;
  tabs: TabInfo[];  // All tabs with this URL
  // Derived/representative values:
  representativeTitle: string;
  representativeFavicon: string | null;
  windowIds: number[];
  tabIds: (number | null)[];
  pinnedAny: boolean;
  groupInfo: TabGroupInfo | null;
}

function aggregateTabsByUrl(
  capturableTabs: TabInfo[],
  groupMap: Map<number, TabGroupInfo>
): Map<string, AggregatedTab> {
  const aggregated = new Map<string, AggregatedTab>();

  for (const tab of capturableTabs) {
    const normalizedUrl = normalizeUrl(tab.url);

    if (!aggregated.has(normalizedUrl)) {
      // First tab with this URL
      const groupInfo = tab.groupId !== -1 ? groupMap.get(tab.groupId) ?? null : null;

      aggregated.set(normalizedUrl, {
        normalizedUrl,
        tabs: [tab],
        representativeTitle: tab.title,
        representativeFavicon: tab.favIconUrl,
        windowIds: [tab.windowId],
        tabIds: [tab.tabId],
        pinnedAny: tab.pinned,
        groupInfo,
      });
    } else {
      // Additional tab with same URL
      const existing = aggregated.get(normalizedUrl)!;
      existing.tabs.push(tab);
      existing.windowIds.push(tab.windowId);
      existing.tabIds.push(tab.tabId);
      if (tab.pinned) existing.pinnedAny = true;

      // Update group info if this tab is in a group and we don't have one yet
      if (!existing.groupInfo && tab.groupId !== -1) {
        existing.groupInfo = groupMap.get(tab.groupId) ?? null;
      }
    }
  }

  return aggregated;
}
```

### Updated Capture Flow

```
1. Query all tabs
2. Filter to capturable URLs
3. Build group map
4. AGGREGATE tabs by normalized URL → Map<normalizedUrl, AggregatedTab>
5. FOR EACH unique URL:
   a. tabCount = aggregatedTab.tabs.length
   b. upsertItemWithCount(url, tabCount) → increments saveCount by tabCount
   c. insertCaptureEvent(captureId, itemId, tabCount, metadata) → ONE event
6. Create capture record with uniqueUrlCount
```

### Updated upsertItem

```typescript
export async function upsertItemWithCount(
  url: string,
  title: string | null,
  favIconUrl: string | null,
  tabCount: number = 1  // NEW: How many tabs had this URL
): Promise<{ item: Item; isNew: boolean; wasDeleted: boolean }> {
  const normalizedUrl = normalizeUrl(url);
  const existing = await db.items.where('normalizedUrl').equals(normalizedUrl).first();

  if (!existing) {
    // Create new item
    const item: Item = {
      itemId: generateId(),
      url,
      normalizedUrl,
      title: title || generateTitleFallback(url),
      domain: extractDomain(url),
      favIconUrl,
      createdAt: Date.now(),
      lastSavedAt: Date.now(),
      saveCount: tabCount,  // Start with tabCount, not 1
      score: 1,
      deletedAt: null,
      lastOpenedAt: null,
      updatedAt: Date.now(),
    };
    await db.items.add(item);
    return { item, isNew: true, wasDeleted: false };
  }

  // Update existing item
  const wasDeleted = existing.deletedAt !== null;
  const updates: Partial<Item> = {
    url,
    title: title || generateTitleFallback(url),
    favIconUrl,
    lastSavedAt: Date.now(),
    saveCount: existing.saveCount + tabCount,  // Increment by tabCount
    updatedAt: Date.now(),
  };

  await db.items.update(existing.itemId, updates);
  return { item: { ...existing, ...updates }, isNew: false, wasDeleted };
}
```

---

## Migration Strategy

### Database Version Upgrade

```typescript
this.version(2).stores({
  items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',
  captures: 'captureId, createdAt',
  captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
}).upgrade(tx => {
  // Add tabCount=1 to existing CaptureEvents
  return tx.table('captureEvents').toCollection().modify(event => {
    if (event.tabCount === undefined) {
      event.tabCount = 1;
    }
    // Convert single windowId to array
    if (!Array.isArray(event.windowIds)) {
      event.windowIds = event.windowId !== undefined ? [event.windowId] : [];
      delete event.windowId;
    }
    // Convert single tabId to array
    if (!Array.isArray(event.tabIds)) {
      event.tabIds = event.tabId !== undefined ? [event.tabId] : [];
      delete event.tabId;
    }
    // Rename pinned to pinnedAny
    if (event.pinnedAny === undefined && event.pinned !== undefined) {
      event.pinnedAny = event.pinned;
      delete event.pinned;
    }
  });
});
```

### Backward Compatibility

- Old CaptureEvents without `tabCount` are treated as `tabCount = 1`
- Old Captures without `uniqueUrlCount` display total tab count instead
- No data loss; all existing functionality preserved

---

## Alternative Approaches Considered

### Alternative A: Change Primary Key to Include tabId

**Approach**: Change captureEvents key from `[captureId, itemId]` to `[captureId, itemId, tabId]`

**Pros**:
- Preserves all individual tab data
- Simple schema change

**Cons**:
- Creates many rows for popular URLs (N rows instead of 1)
- Complicates queries for "items in capture X"
- Inflates storage for no practical benefit
- Makes statistics calculation expensive

**Decision**: Rejected - aggregation is cleaner

### Alternative B: Allow Duplicate Primary Keys

**Approach**: Remove unique constraint on `[captureId, itemId]`

**Pros**:
- Minimal code change

**Cons**:
- Violates data integrity
- Multiple rows with same logical identity is confusing
- Harder to update/delete specific events

**Decision**: Rejected - breaks data model

### Alternative C: Ignore Duplicate Tabs (Dedupe Before Insert)

**Approach**: Simply skip duplicate URLs in the capture loop

**Pros**:
- Quick fix
- Preserves current schema

**Cons**:
- Loses valuable relevance signal
- Doesn't match user's desired behavior
- saveCount doesn't reflect actual tab occurrences

**Decision**: Rejected - loses important functionality

---

## Implementation Plan

### Phase 1: Schema Updates

1. Add new fields to TypeScript interfaces
2. Create Dexie migration (version 2)
3. Update type exports

### Phase 2: Aggregation Logic

1. Create `aggregateTabsByUrl()` utility in `tabs.ts`
2. Create `AggregatedTab` interface

### Phase 3: Capture Pipeline Updates

1. Update `capture.ts` to use aggregation
2. Update `upsertItem` → `upsertItemWithCount`
3. Update `insertCaptureEvent` call with new fields
4. Update capture statistics

### Phase 4: Verification

1. Run `pnpm typecheck`
2. Run `pnpm build`
3. Manual testing:
   - Capture with duplicate tabs
   - Verify saveCount increments correctly
   - Verify CaptureEvent has correct tabCount
   - Verify no errors

---

## Testing Scenarios

### Scenario 1: Basic Duplicate Handling

**Setup**:
- Open reddit.com in 3 tabs

**Expected**:
- One Item created with `saveCount = 3`
- One CaptureEvent with `tabCount = 3`
- `windowIds` contains all 3 window IDs

### Scenario 2: Duplicate of Existing Item

**Setup**:
- Previous capture saved reddit.com (`saveCount = 1`)
- Open reddit.com in 2 tabs

**Expected**:
- Item updated with `saveCount = 3` (1 + 2)
- New CaptureEvent with `tabCount = 2`

### Scenario 3: Hidden Item with Duplicates

**Setup**:
- Hide gmail.com
- Open gmail.com in 5 tabs

**Expected**:
- Item updated with `saveCount += 5`
- Item remains hidden (`deletedAt` preserved)
- CaptureEvent with `tabCount = 5`

### Scenario 4: Mixed Capture

**Setup**:
- Tab 1: news.ycombinator.com (new)
- Tab 2: news.ycombinator.com (duplicate)
- Tab 3: github.com (new)
- Tab 4: reddit.com (existing, hidden)
- Tab 5: reddit.com (duplicate of hidden)

**Expected**:
- HN: Item created, `saveCount = 2`, CaptureEvent `tabCount = 2`
- GitHub: Item created, `saveCount = 1`, CaptureEvent `tabCount = 1`
- Reddit: Item updated, `saveCount += 2`, stays hidden, CaptureEvent `tabCount = 2`
- Capture stats: `uniqueUrlCount = 3`, `tabCountCaptured = 5`

---

## Open Questions

1. **Pinned tab counting**: If reddit.com is open in 3 tabs, one pinned, should we track:
   - Just `pinnedAny: true`? (proposed)
   - `pinnedCount: number`?
   - Array of pinned status per tab?

2. **Tab group aggregation**: If the same URL is in multiple tab groups, which group info do we keep?
   - First encountered? (proposed)
   - All groups as array?
   - Most recent?

3. **Representative metadata**: When aggregating, which tab's title/favicon do we use?
   - First tab? (proposed)
   - Most recently focused?
   - Longest title?

---

## Summary

This design addresses the duplicate URL capture error by:

1. **Aggregating tabs by normalized URL** before processing
2. **Adding `tabCount` to CaptureEvent** to track multiplicity
3. **Incrementing `saveCount` by tabCount** instead of always +1
4. **Converting single-value fields to arrays** where multiple tabs contribute

The result is a more accurate relevance signal where frequently-opened URLs bubble up naturally, helping users identify and triage their tab hoarding patterns.
