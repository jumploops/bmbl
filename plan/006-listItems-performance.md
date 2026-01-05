# Plan: Fix listItemsV2 Performance

**Date**: 2026-01-05
**Status**: Implemented
**Priority**: High

---

## Problem Statement

`listItemsV2` in `src/lib/db/items.ts:91-142` loads ALL items into memory before filtering, sorting, and paginating:

```ts
export async function listItemsV2(options: ListOptions): Promise<Item[]> {
  let items = await db.items.toArray();  // ← Loads EVERYTHING

  // Filter in JS
  switch (view) { ... items.filter(...) }

  // Sort in JS
  switch (view) { ... items.sort(...) }

  // Paginate in JS
  return items.slice(offset, offset + limit);
}
```

**Impact**: Linear degradation with item count. At 1,000 items, each page load fetches ~100KB+ and sorts in JS. At 10,000 items, this becomes unusable.

**Related issue**: `getItemCount()` has the same problem (loads all items to count non-deleted ones).

---

## Current Schema & Indexes

```ts
// From schema.ts (version 4)
items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, favoritedAt, deletedAt, updatedAt'
```

**Indexes available**:
- `itemId` (primary key)
- `normalizedUrl` (unique)
- `lastSavedAt`
- `saveCount`
- `favoritedAt`
- `deletedAt`
- `updatedAt`

---

## View Requirements Analysis

| View | Filter | Sort | Secondary Sort |
|------|--------|------|----------------|
| `new` | `deletedAt === null` | `lastSavedAt DESC` | - |
| `old` | `deletedAt === null` | `lastSavedAt ASC` | - |
| `favorites` | `deletedAt === null && favoritedAt !== null` | `favoritedAt DESC` | `lastSavedAt DESC` |
| `frequent` | `deletedAt === null` | `saveCount DESC` | `lastSavedAt DESC` |
| `hidden` | `deletedAt !== null` | `deletedAt DESC` | - |

---

## Dexie Constraints

Understanding Dexie's limitations is critical for choosing the right approach:

1. **NULL values are excluded from indexes**
   - `WHERE deletedAt = null` cannot use an index
   - This is the core problem—our most common filter is unindexable

2. **Can't combine `.where()` and `.orderBy()` on different fields**
   - `.where('deletedAt').equals(0).orderBy('lastSavedAt')` ← Won't use both indexes
   - Need compound index `[deletedAt+lastSavedAt]` for efficient query

3. **Compound indexes enable filter+sort**
   - `[deletedAt+lastSavedAt]` allows: filter by deletedAt, sort by lastSavedAt
   - Query: `.where('[deletedAt+lastSavedAt]').between([0, Dexie.minKey], [0, Dexie.maxKey])`

4. **Multi-field sorts require compound indexes or JS**
   - `favorites` needs sort by `favoritedAt DESC, lastSavedAt DESC`
   - Either use `[deletedAt+favoritedAt+lastSavedAt]` or sort tiebreaker in JS

---

## Options

### Option A: Sentinel Values + Compound Indexes

**Approach**: Replace `null` with `0` for nullable timestamp fields, add compound indexes.

**Schema Changes**:
```ts
// Version 5
items: 'itemId, &normalizedUrl, [deletedAt+lastSavedAt], [deletedAt+favoritedAt], [deletedAt+saveCount], deletedAt, updatedAt'
```

**Data Migration**:
- `deletedAt: null` → `deletedAt: 0`
- `favoritedAt: null` → `favoritedAt: 0`

**Query Examples**:
```ts
// new view
db.items
  .where('[deletedAt+lastSavedAt]')
  .between([0, Dexie.minKey], [0, Dexie.maxKey])
  .reverse()
  .offset(offset)
  .limit(limit)
  .toArray()

// hidden view
db.items
  .where('deletedAt')
  .above(0)
  .reverse()
  .offset(offset)
  .limit(limit)
  .toArray()
```

**Pros**:
- Fully indexed queries for all views
- Predictable O(log n + k) performance (k = page size)
- Clean, well-understood pattern

**Cons**:
- Requires migration (version 5)
- Semantic change: 0 means "not set" instead of null
- Need to update all code that reads/writes these fields
- Secondary sorts (favorites, frequent) still need small in-memory sort

**Complexity**: Medium

---

### Option B: Streaming Filter with Early Termination

**Approach**: Keep schema as-is, but iterate with index-based sort and filter in streaming fashion.

```ts
async function listNew(limit: number, offset: number): Promise<Item[]> {
  const results: Item[] = [];
  let skipped = 0;

  await db.items
    .orderBy('lastSavedAt')
    .reverse()
    .until(() => results.length >= limit)
    .each(item => {
      if (item.deletedAt !== null) return;  // Skip deleted
      if (skipped < offset) { skipped++; return; }
      results.push(item);
    });

  return results;
}
```

**Pros**:
- No migration needed
- No schema changes
- Uses existing indexes for sort order

**Cons**:
- Still iterates through deleted items (wasted work)
- Deep pagination gets slow (offset=1000 means scanning 1000+ items)
- Can't efficiently get total count
- Code is more complex

**Complexity**: Low initially, but scales poorly

---

### Option C: Cursor-Based Pagination

**Approach**: Replace offset/limit with cursor-based pagination.

```ts
interface ListOptions {
  view: ViewType;
  limit: number;
  cursor?: {
    lastSavedAt: number;
    itemId: string;  // Tiebreaker for items with same timestamp
  };
}

// Query: items after cursor, sorted by lastSavedAt DESC
db.items
  .where('[deletedAt+lastSavedAt]')
  .between([0, Dexie.minKey], [0, cursor.lastSavedAt])
  .reverse()
  .filter(item => {
    // Handle tiebreaker
    if (item.lastSavedAt === cursor.lastSavedAt) {
      return item.itemId < cursor.itemId;
    }
    return true;
  })
  .limit(limit)
  .toArray()
```

**Pros**:
- Constant-time pagination regardless of depth
- Natural fit for infinite scroll
- Most efficient for large datasets

**Cons**:
- API change required (useItems hook, ItemList component)
- Can't jump to arbitrary page (not needed for infinite scroll)
- More complex cursor handling
- Still needs sentinel values for null fields

**Complexity**: High

---

### Option D: Hybrid - Optimize Common Case Only

**Approach**: Fully optimize `new` view (most used), accept slower performance for other views.

**Rationale**:
- `new` is the default view and most frequently accessed
- `hidden` is rarely used
- `favorites` and `frequent` are less common and typically have fewer items

```ts
async function listItems(options: ListOptions): Promise<Item[]> {
  switch (options.view) {
    case 'new':
      return listNewOptimized(options);  // Compound index query
    case 'old':
      return listOldOptimized(options);  // Compound index query
    default:
      return listGeneric(options);  // Current approach, acceptable for small sets
  }
}
```

**Pros**:
- Simpler implementation
- Optimizes the critical path
- Smaller migration scope

**Cons**:
- Inconsistent performance across views
- "Frequent" view could still be slow with many items
- Technical debt (different code paths)

**Complexity**: Low-Medium

---

## Recommendation: Option A (Sentinel Values + Compound Indexes)

**Rationale**:

1. **Correctness**: All views get consistent, predictable performance
2. **Simplicity**: Single pattern for all queries (compound index + range query)
3. **Future-proof**: Supports future features (search, filters) without rearchitecting
4. **Acceptable migration**: One-time schema upgrade, data transformation is straightforward

**Trade-off accepted**: Secondary sorts (favorites tiebreaker, frequent tiebreaker) will do small in-memory sorts on the page of results. With 30 items per page, this is negligible.

---

## Implementation Plan

### Phase 1: Schema Migration (Version 5)

**File**: `src/lib/db/schema.ts`

```ts
// Version 5: Add compound indexes, convert nulls to sentinel values
this.version(5)
  .stores({
    items: 'itemId, &normalizedUrl, [deletedAt+lastSavedAt], [deletedAt+favoritedAt], [deletedAt+saveCount], deletedAt, updatedAt',
    captures: 'captureId, createdAt',
    captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
  })
  .upgrade((tx) => {
    return tx
      .table('items')
      .toCollection()
      .modify((item: Record<string, unknown>) => {
        // Convert null to 0 for deletedAt
        if (item.deletedAt === null || item.deletedAt === undefined) {
          item.deletedAt = 0;
        }
        // Convert null to 0 for favoritedAt
        if (item.favoritedAt === null || item.favoritedAt === undefined) {
          item.favoritedAt = 0;
        }
      });
  });
```

**Index changes**:
- Remove: `lastSavedAt`, `saveCount`, `favoritedAt` (individual indexes)
- Add: `[deletedAt+lastSavedAt]`, `[deletedAt+favoritedAt]`, `[deletedAt+saveCount]`
- Keep: `deletedAt` (for hidden view), `updatedAt`

### Phase 2: Update Type Definitions

**File**: `src/types/index.ts`

```ts
export interface Item {
  // ...
  favoritedAt: number;  // 0 = not favorited (was: number | null)
  deletedAt: number;    // 0 = not deleted (was: number | null)
  // ...
}
```

Add constants for clarity:
```ts
export const NOT_DELETED = 0;
export const NOT_FAVORITED = 0;
```

### Phase 3: Rewrite Query Functions

**File**: `src/lib/db/items.ts`

```ts
import Dexie from 'dexie';
import { NOT_DELETED, NOT_FAVORITED } from '@/types';

/**
 * List items for a view with efficient indexed queries
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

async function listFavorites(limit: number, offset: number): Promise<Item[]> {
  // Get favorited items (favoritedAt > 0), sorted by favoritedAt DESC
  const items = await db.items
    .where('[deletedAt+favoritedAt]')
    .between(
      [NOT_DELETED, 1],  // favoritedAt > 0
      [NOT_DELETED, Dexie.maxKey]
    )
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();

  // Secondary sort by lastSavedAt for items with same favoritedAt
  // (negligible for 30 items)
  return items.sort((a, b) => {
    if (b.favoritedAt !== a.favoritedAt) return b.favoritedAt - a.favoritedAt;
    return b.lastSavedAt - a.lastSavedAt;
  });
}

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
 * Get count of active (non-deleted) items
 */
export async function getActiveItemCount(): Promise<number> {
  return db.items
    .where('[deletedAt+lastSavedAt]')
    .between([NOT_DELETED, Dexie.minKey], [NOT_DELETED, Dexie.maxKey])
    .count();
}

/**
 * Get total item count (including deleted)
 */
export async function getTotalItemCount(): Promise<number> {
  return db.items.count();
}
```

### Phase 4: Update All Read/Write Code

Update functions that read or write `deletedAt` and `favoritedAt`:

**`createItemFromTab`** (`src/lib/db/items.ts`):
```ts
return {
  // ...
  favoritedAt: NOT_FAVORITED,  // was: null
  deletedAt: NOT_DELETED,      // was: null
  // ...
};
```

**`setFavorite`**:
```ts
export async function setFavorite(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    favoritedAt: Date.now(),  // No change needed
    updatedAt: Date.now(),
  });
}
```

**`unsetFavorite`**:
```ts
export async function unsetFavorite(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    favoritedAt: NOT_FAVORITED,  // was: null
    updatedAt: Date.now(),
  });
}
```

**`softDelete`**:
```ts
export async function softDelete(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    deletedAt: Date.now(),  // No change needed
    updatedAt: Date.now(),
  });
}
```

**`restore`**:
```ts
export async function restore(itemId: string): Promise<void> {
  await db.items.update(itemId, {
    deletedAt: NOT_DELETED,  // was: null
    updatedAt: Date.now(),
  });
}
```

### Phase 5: Update UI Code

**`src/components/ItemRow.tsx`**:
```ts
// Check for favorited
{item.favoritedAt > 0 && (  // was: item.favoritedAt !== null
  // ...
)}
```

**`src/hooks/useItems.ts`**:
```ts
// Optimistic update for favorite
setItems((prev) =>
  prev.map((item) =>
    item.itemId === itemId ? { ...item, favoritedAt: Date.now() } : item
  )
);

// Revert for unfavorite
setItems((prev) =>
  prev.map((item) =>
    item.itemId === itemId ? { ...item, favoritedAt: NOT_FAVORITED } : item  // was: null
  )
);
```

### Phase 6: Cleanup

1. **Rename function**: `listItemsV2` → `listItems`
2. **Remove**: Old `getItemCount` function, replace with `getActiveItemCount` / `getTotalItemCount`
3. **Remove**: Unused individual indexes from schema string
4. **Update tests**: `src/lib/utils/url.test.ts` doesn't need changes, but consider adding DB tests

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add version 5 migration |
| `src/types/index.ts` | Change `favoritedAt` and `deletedAt` from `number \| null` to `number`, add constants |
| `src/lib/db/items.ts` | Rewrite query functions, rename, cleanup |
| `src/components/ItemRow.tsx` | Update favoritedAt checks |
| `src/hooks/useItems.ts` | Update optimistic updates |

---

## Testing Plan

1. **Fresh install**: Verify version 5 schema creates correct indexes
2. **Migration**: Test upgrade from version 4 → 5 with existing data
3. **Each view**: Verify correct items returned in correct order
4. **Pagination**: Verify offset/limit work correctly
5. **Performance**: Measure query time with 1,000+ items
6. **Edge cases**: Empty database, all items deleted, no favorites

---

## Rollback Plan

If issues arise after deployment:
1. Schema changes are additive (compound indexes added)
2. Data migration is reversible (`0` → `null` if needed)
3. Keep old query code commented for quick revert

---

## Open Questions

1. **Secondary sort accuracy**: Is it acceptable that favorites/frequent views may have slight ordering inconsistencies at page boundaries for items with identical primary sort values?
   - **Answer**: Yes, this edge case is rare and the visual impact is minimal.

2. **Should we also convert `lastOpenedAt: null` to `lastOpenedAt: 0`?**
   - **Recommendation**: Yes, for consistency, even though it's not currently indexed.

3. **Future cursor-based pagination?**
   - **Recommendation**: Defer. Offset-based is sufficient for MVP. Can add cursor-based later if needed for very large datasets (10,000+ items).
