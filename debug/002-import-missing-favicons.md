# Debug: Imported Bookmarks Missing Favicons

**Date**: 2026-01-05
**Status**: Resolved
**Severity**: Medium (UX issue, not data loss)

---

## Problem Statement

After exporting bookmarks from one dev profile and importing into another, all imported bookmarks show the fallback Globe icon instead of their original favicons.

---

## Root Cause Analysis

### Finding 1: Favicons Not Included in Export Format

**File**: `src/lib/export/types.ts:9-18`

```typescript
export interface ExportedItem {
  url: string;
  title: string;
  domain?: string;
  createdAt?: number;
  lastSavedAt?: number;
  saveCount?: number;
  favoritedAt?: number;
  deletedAt?: number;
  // NOTE: favIconUrl is NOT included
}
```

The `ExportedItem` type does not include `favIconUrl`, so it's never exported.

### Finding 2: Export Function Omits Favicons

**File**: `src/lib/export/exportJson.ts:25-36`

```typescript
const exportedItems: ExportedItem[] = items.map((item) => ({
  url: item.url,
  title: item.title,
  domain: item.domain,
  createdAt: item.createdAt,
  lastSavedAt: item.lastSavedAt,
  saveCount: item.saveCount,
  // favIconUrl is not mapped
  ...(item.favoritedAt > 0 && { favoritedAt: item.favoritedAt }),
  ...(item.deletedAt > 0 && { deletedAt: item.deletedAt }),
}));
```

Even though `Item` has `favIconUrl`, it's not included in the export mapping.

### Finding 3: Import Explicitly Sets Favicons to Null

**File**: `src/lib/import/importJson.ts:109-124`

```typescript
async function insertItem(
  item: ExportedItem,
  normalizedUrl: string
): Promise<void> {
  // ...
  await db.items.add({
    // ...
    favIconUrl: null, // Don't import stale favicons  <-- INTENTIONAL
    // ...
  });
}
```

The comment "Don't import stale favicons" indicates this was a deliberate design decision.

### Finding 4: No Favicon Refresh Mechanism

The extension only obtains favicons from Chrome's `tab.favIconUrl` API when tabs are captured. There is no mechanism to:
- Fetch favicons from a URL after the fact
- Refresh stale favicons for existing items
- Update favicons when re-visiting a page

---

## Why This Happens

### Favicon Lifecycle in bmbl

```
Tab opened → Chrome provides favIconUrl → Capture stores it → Display in UI
                         ↓
                 (Only source of favicons)
```

### Import Breaks the Chain

```
Export (no favicon) → Import (favicon = null) → Display shows Globe icon
```

---

## Potential Solutions

### Option A: Include Favicons in Export/Import (Simple)

**Pros:**
- Simple implementation
- Preserves original favicon URLs
- Works for most cases where URLs haven't changed

**Cons:**
- Favicon URLs can become stale (site changes favicon, CDN URL expires)
- Some favicon URLs are data URIs (large, bloat export file)
- Cross-profile imports may have CORS/permission issues with some favicon URLs

**Implementation:**
1. Add `favIconUrl?: string | null` to `ExportedItem`
2. Include in export mapping
3. Use in import if present (fallback to null)

### Option B: Fetch Favicons via External Service

Use a favicon service like Google's or DuckDuckGo's:
- `https://www.google.com/s2/favicons?domain={domain}&sz=32`
- `https://icons.duckduckgo.com/ip3/{domain}.ico`

**Pros:**
- Always fresh favicons
- Works for any URL
- Small, consistent file sizes

**Cons:**
- Requires network requests (currently extension has none)
- Privacy implications (leaking browsing history to third party)
- Service availability/reliability dependency
- Adds `host_permissions` to manifest

### Option C: Hybrid - Export URLs, Fetch on Display

Export favicon URLs, but if the URL fails to load, fall back to a favicon service.

**Pros:**
- Best of both worlds
- Graceful degradation

**Cons:**
- Complex implementation
- Still has privacy implications if fallback is used

### Option D: Accept Limitation, Document It

Keep current behavior but clearly document that favicons are not preserved during import.

**Pros:**
- No code changes
- No privacy implications

**Cons:**
- Poor UX for imported bookmarks
- Users expect favicons to work

---

## Recommendation

**Option A (Include Favicons in Export/Import)** is recommended for the following reasons:

1. **Simplicity**: Minimal code changes
2. **No external dependencies**: Keeps the "no network calls" property of the extension
3. **Good enough**: Most favicon URLs remain valid for reasonable timeframes
4. **Data URI support**: If favicon is a data URI, it will work indefinitely
5. **Graceful degradation**: If URL fails, `onError` handler already hides broken images

### Considerations for Implementation

1. **Large data URIs**: Could add a size limit (e.g., skip data URIs > 10KB)
2. **Validation**: Only import http/https/data URLs for favicons
3. **Optional export**: Could make favicon export optional (checkbox in UI)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/export/types.ts` | Add `favIconUrl?: string \| null` to `ExportedItem` |
| `src/lib/export/exportJson.ts` | Include `favIconUrl` in export mapping |
| `src/lib/import/importJson.ts` | Use `item.favIconUrl` instead of `null` in `insertItem` |
| `src/lib/import/importJson.ts` | Optionally: Add to `mergeItem` if existing has no favicon |

---

## Testing Plan

1. Export bookmarks from profile with favicons
2. Inspect JSON - verify favIconUrl fields are present
3. Import into fresh profile
4. Verify favicons display correctly
5. Test with:
   - Regular http/https favicon URLs
   - Data URI favicons
   - Missing favicons (should still show Globe)
   - Invalid/broken favicon URLs (should fall back to Globe)

---

## Resolution

**Fixed 2026-01-05**

Implemented Option A (Include Favicons in Export/Import):

1. Added `favIconUrl?: string | null` to `ExportedItem` type
2. Included `favIconUrl` in export mapping
3. Used `item.favIconUrl ?? null` in `insertItem` instead of hardcoded `null`
4. Updated `mergeItem` to fill in favicon if existing item has none
