# Bug: Duplicate URL Capture Error

**Date**: 2026-01-04
**Status**: Investigating
**Severity**: High (blocks core functionality)

---

## Problem Description

When capturing tabs that include URLs already saved in the database (duplicates), the capture process throws an error instead of gracefully incrementing the `saveCount` for those URLs.

### Expected Behavior

1. **Duplicate URLs** (same as previously saved): Should increment `saveCount` and update `lastSavedAt`
2. **Hidden items** (soft-deleted): Should still increment `saveCount` but remain hidden (`deletedAt` preserved)
3. **No errors**: The capture process should complete successfully regardless of duplicates

### Observed Behavior

- Error thrown during capture when duplicate URLs exist
- Capture may fail entirely or partially

---

## Investigation

### Code Analysis

#### 1. Database Schema (`src/lib/db/schema.ts`)

```typescript
this.version(1).stores({
  items: 'itemId, &normalizedUrl, lastSavedAt, saveCount, score, deletedAt, updatedAt',
  captures: 'captureId, createdAt',
  captureEvents: '[captureId+itemId], captureId, itemId, capturedAt, groupTitle',
});
```

Key observations:
- `items` table has `&normalizedUrl` (unique index) — prevents duplicate URLs ✓
- `captureEvents` has `[captureId+itemId]` compound primary key — **one event per item per capture**

#### 2. Item Upsert Logic (`src/lib/db/items.ts`)

```typescript
export async function upsertItem(url, title, favIconUrl) {
  const normalizedUrl = normalizeUrl(url);
  const existing = await db.items.where('normalizedUrl').equals(normalizedUrl).first();

  if (!existing) {
    // Create new item
    await db.items.add(item);
    return { item, isNew: true, wasDeleted: false };
  }

  // Update existing item
  const updates = {
    saveCount: existing.saveCount + 1,  // ✓ Increments correctly
    // deletedAt: preserved (not changed) // ✓ Hidden items stay hidden
  };

  await db.items.update(existing.itemId, updates);
  return { item: updatedItem, isNew: false, wasDeleted };
}
```

This looks correct for handling duplicates between captures.

#### 3. Capture Logic (`src/lib/capture/capture.ts`)

```typescript
for (const tab of capturableTabs) {
  const { item } = await upsertItem(tab.url, tab.title, tab.favIconUrl);

  const event: CaptureEvent = {
    captureId,
    itemId: item.itemId,  // Same itemId for duplicate URLs!
    // ...
  };

  await insertCaptureEvent(event);  // ⚠️ POTENTIAL ISSUE
}
```

**Critical Finding**: If multiple open tabs have the **same URL**, they will:
1. Both upsert to the same `itemId`
2. Both try to create a `CaptureEvent` with `[captureId, itemId]`
3. Second insert fails due to **primary key constraint violation**

---

## Hypotheses

### Hypothesis 1: Duplicate CaptureEvents within a Single Capture (HIGH CONFIDENCE)

**Root Cause**: When multiple tabs with the same URL are open simultaneously, the capture loop processes each tab individually. Since `upsertItem()` returns the same `itemId` for duplicate URLs, the code attempts to insert multiple `CaptureEvent` records with the same `[captureId, itemId]` compound key, violating the primary key constraint.

**Evidence**:
- `captureEvents` schema: `[captureId+itemId]` is the primary key
- No deduplication of tabs by URL before processing
- Each tab creates a new CaptureEvent regardless of URL uniqueness

**Reproduction Steps**:
1. Open the same URL in multiple tabs (e.g., reddit.com in 3 tabs)
2. Click the bmbl icon to capture
3. Observe error in console

---

### Hypothesis 2: Race Condition in Concurrent upsertItem Calls (MEDIUM CONFIDENCE)

**Root Cause**: Although the capture uses a Dexie transaction, the `upsertItem` function does a read-then-write pattern that could race:
1. Check if item exists → not found
2. Another concurrent call checks → not found
3. First call inserts
4. Second call tries to insert → unique constraint violation on `&normalizedUrl`

**Evidence**:
- The transaction uses `'rw'` mode but upsert is not atomic
- Sequential `for...of` loop should mitigate this, but async/await timing could cause issues

**Why Less Likely**:
- The `for...of` loop with `await` should be sequential within the transaction
- Dexie transactions should prevent this within a single transaction

---

### Hypothesis 3: Stale Transaction Context (LOW CONFIDENCE)

**Root Cause**: The Dexie transaction may become stale if operations take too long, causing subsequent operations to fail.

**Evidence**:
- Large tab counts could exceed transaction timeout
- IndexedDB has implementation-specific timeout behavior

**Why Less Likely**:
- This would cause failures regardless of duplicates
- Error message would typically indicate transaction issues

---

### Hypothesis 4: Unique Index Violation on Items Table (LOW CONFIDENCE)

**Root Cause**: The `&normalizedUrl` unique index could be violated if `normalizeUrl()` produces different outputs for URLs that should be considered the same, then later produces the same output.

**Evidence**:
- `normalizeUrl()` has edge cases (fragments, trailing slashes, case)
- URL could be normalized differently at different times

**Why Less Likely**:
- The `upsertItem` function queries by `normalizedUrl` first
- Would only fail on insert, not update

---

### Hypothesis 5: IndexedDB Corruption or Browser State (VERY LOW CONFIDENCE)

**Root Cause**: Previous failed transactions left the database in an inconsistent state.

**Evidence**:
- IndexedDB can become corrupted on crash
- Development mode with hot reload could cause issues

**Why Less Likely**:
- Would affect all operations, not just duplicates
- Clearing IndexedDB and retrying would reveal this

---

## Recommended Investigation Steps

1. **Verify Hypothesis 1**:
   - Open Chrome DevTools on the service worker
   - Open 2+ tabs with the same URL
   - Click capture and observe the exact error message
   - Check if error mentions "ConstraintError" or primary key violation

2. **Add Diagnostic Logging**:
   ```typescript
   console.log('Processing tab:', tab.url, 'itemId:', item.itemId);
   ```

3. **Check for Duplicate URLs in capturableTabs**:
   - Log `capturableTabs.map(t => t.url)` before the loop
   - Look for duplicate URLs

---

## Proposed Fix Direction

If Hypothesis 1 is confirmed, the fix would involve **deduplicating tabs by URL before processing**:

```typescript
// Dedupe tabs by normalized URL (keep first occurrence)
const seenUrls = new Set<string>();
const uniqueTabs = capturableTabs.filter(tab => {
  const normalized = normalizeUrl(tab.url);
  if (seenUrls.has(normalized)) return false;
  seenUrls.add(normalized);
  return true;
});

// Process only unique tabs
for (const tab of uniqueTabs) {
  // ... existing logic
}
```

Alternatively, change `CaptureEvent` to allow multiple events per item per capture (change primary key to include `tabId`).

---

## Additional Considerations

- **saveCount** should increment once per capture, not once per tab with the same URL
- **CaptureEvent** semantics: should we record each tab or each unique URL?
- Current behavior would double-count `saveCount` for duplicate tabs even if insertion succeeded
