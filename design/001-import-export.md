# Design: Import/Export Bookmarks

**Date**: 2026-01-05
**Status**: Research Complete
**Priority**: Medium

---

## Problem Statement

Users want to transfer their bmbl bookmarks between:
- Different Chrome profiles (work vs personal)
- Different browsers (Chrome, Firefox, Edge)
- Different computers
- Backup/restore scenarios

Currently, all data is stored locally in IndexedDB with no way to extract or import it.

---

## Current Data Model

### Primary Entity: `Item` (src/types/index.ts:14-28)

```typescript
interface Item {
  itemId: string;           // UUID, primary key
  url: string;              // Original URL
  normalizedUrl: string;    // Dedupe key (lowercase, no fragment)
  title: string;            // Page title
  domain: string;           // Display domain (no www.)
  favIconUrl: string | null; // Favicon URL (may be stale/broken)
  createdAt: number;        // First saved timestamp
  lastSavedAt: number;      // Most recent save timestamp
  saveCount: number;        // Times captured
  favoritedAt: number;      // 0 = not favorited, else timestamp
  deletedAt: number;        // 0 = not deleted, else timestamp
  lastOpenedAt: number;     // 0 = never opened, else timestamp
  updatedAt: number;        // Last modification timestamp
}
```

### Secondary Entities

**`Capture`**: Session metadata (when captures happened, counts)
**`CaptureEvent`**: Links items to captures (tab groups, window info)

### Settings (chrome.storage.sync)

```typescript
interface Settings {
  autoCloseAfterSave: boolean;
  resurfaceHiddenOnRecapture: boolean;
  defaultView: ViewType;
  darkMode: DarkMode;
}
```

---

## Research: Export Formats

### Option 1: JSON (bmbl-native)

**Format**: Custom JSON matching our Item schema

```json
{
  "version": 1,
  "exportedAt": "2026-01-05T12:00:00.000Z",
  "itemCount": 150,
  "items": [
    {
      "url": "https://example.com/article",
      "title": "Example Article",
      "domain": "example.com",
      "createdAt": 1704412800000,
      "lastSavedAt": 1704499200000,
      "saveCount": 3,
      "favoritedAt": 1704412800000,
      "deletedAt": 0
    }
  ]
}
```

**Pros**:
- Full fidelity - preserves all bmbl metadata (favorites, save counts, timestamps)
- Easy to parse and validate
- Round-trip import/export without data loss
- Can include version for future schema changes

**Cons**:
- Not compatible with other bookmark managers
- Users can't import existing bookmarks from Chrome/Firefox

**Best for**: bmbl-to-bmbl transfers, backups

---

### Option 2: Netscape Bookmark HTML

**Format**: Standard bookmark format used by all major browsers

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1704412800" LAST_MODIFIED="1704499200">bmbl Bookmarks</H3>
  <DL><p>
    <DT><A HREF="https://example.com/article" ADD_DATE="1704412800">Example Article</A>
    <DT><A HREF="https://example.com/another" ADD_DATE="1704412900">Another Page</A>
  </DL><p>
</DL><p>
```

**Pros**:
- Universal compatibility (Chrome, Firefox, Safari, Edge, Brave)
- Users can import their existing browser bookmarks into bmbl
- Can be opened directly in browser for manual inspection
- Well-documented format (since Netscape Navigator)

**Cons**:
- Loses bmbl-specific metadata (saveCount, favoritedAt, deletedAt)
- Limited to: URL, title, ADD_DATE, and folder structure
- No standard for "favorited" or "hidden" status
- Parsing HTML is more complex than JSON

**Best for**: Cross-browser compatibility, importing from other sources

---

### Option 3: CSV

**Format**: Simple tabular format

```csv
url,title,domain,createdAt,saveCount,favorited
https://example.com/article,Example Article,example.com,2026-01-05,3,true
```

**Pros**:
- Human readable, editable in Excel/Sheets
- Simple to parse
- Can include arbitrary columns

**Cons**:
- Escaping issues with commas/quotes in titles
- No standard schema
- Loses nested structure (no folder concept)
- Not importable by browsers directly

**Best for**: Data analysis, spreadsheet users (not recommended as primary)

---

### Option 4: Hybrid Approach

**Export**: Offer both JSON (full fidelity) and HTML (compatibility)
**Import**: Accept both JSON (bmbl backups) and HTML (browser bookmarks)

This gives users flexibility:
- Use JSON for bmbl-to-bmbl transfers and backups
- Use HTML to import existing bookmarks or share with non-bmbl users

---

## Recommendation: Hybrid (JSON + HTML)

**Phase 1**: JSON only (simpler, covers backup/restore use case)
**Phase 2**: Add HTML import (accept browser bookmarks)
**Phase 3**: Add HTML export (share with non-bmbl users)

---

## Export Design

### What to Export

| Data | Include? | Rationale |
|------|----------|-----------|
| Items (non-deleted) | Yes | Core data |
| Items (deleted/hidden) | Optional | User choice, default: no |
| Favorites metadata | Yes | Preserves organization |
| Save counts/timestamps | Yes | Preserves history |
| Settings | Optional | Separate export, not mixed with items |
| Captures/CaptureEvents | No | Internal analytics, not user-facing |

### Export Options

```typescript
interface ExportOptions {
  includeHidden: boolean;  // Include soft-deleted items
  format: 'json' | 'html'; // Output format (Phase 2)
}
```

### JSON Export Schema (v1)

```typescript
interface BmblExport {
  version: 1;
  exportedAt: string;      // ISO 8601
  source: {
    extensionVersion: string;
    browser: string;       // "chrome" | "firefox" | etc.
  };
  options: {
    includeHidden: boolean;
  };
  stats: {
    totalItems: number;
    favoriteCount: number;
    hiddenCount: number;   // Only if includeHidden
  };
  items: ExportedItem[];
}

interface ExportedItem {
  // Core (always included)
  url: string;
  title: string;

  // Optional metadata
  domain?: string;
  createdAt?: number;
  lastSavedAt?: number;
  saveCount?: number;
  favoritedAt?: number;    // 0 omitted, >0 included
  deletedAt?: number;      // Only if includeHidden and deleted

  // Explicitly NOT included
  // - itemId (regenerated on import)
  // - normalizedUrl (recomputed on import)
  // - favIconUrl (stale, refetched on visit)
  // - lastOpenedAt (local state)
  // - updatedAt (local state)
}
```

**Design decisions**:

1. **No itemId**: IDs are regenerated on import to avoid conflicts
2. **No normalizedUrl**: Recomputed using current normalization logic (may improve over time)
3. **No favIconUrl**: Often stale/broken; browser will fetch fresh on visit
4. **No lastOpenedAt/updatedAt**: These are local interaction state, not transferable

### File Naming

```
bmbl-export-2026-01-05.json
bmbl-export-2026-01-05.html  (Phase 2)
```

---

## Import Design

### Import Sources

| Source | Phase | Complexity |
|--------|-------|------------|
| bmbl JSON | 1 | Low |
| Netscape HTML (Chrome/Firefox export) | 2 | Medium |
| Chrome bookmarks API direct | Future | High (requires `bookmarks` permission) |

### Conflict Resolution

When importing an item where `normalizedUrl` already exists:

| Strategy | Behavior |
|----------|----------|
| **Skip** | Keep existing, ignore import (default) |
| **Merge** | Update metadata (increment saveCount, update timestamps) |
| **Replace** | Overwrite existing with imported |

**Recommendation**: Default to **Skip** with user toggle for **Merge**.

Replace is risky (loses local data) and rarely wanted.

### Import Options

```typescript
interface ImportOptions {
  conflictStrategy: 'skip' | 'merge';
  markAsNew: boolean;  // Reset timestamps to now (fresh start)
}
```

### Merge Logic

When `conflictStrategy: 'merge'`:

```typescript
existingItem.saveCount += importedItem.saveCount || 1;
existingItem.lastSavedAt = Math.max(existing.lastSavedAt, imported.lastSavedAt || 0);
existingItem.createdAt = Math.min(existing.createdAt, imported.createdAt || Infinity);

// Favorited: keep if either is favorited
if (imported.favoritedAt && !existing.favoritedAt) {
  existing.favoritedAt = imported.favoritedAt;
}

// Deleted: resurrect if imported is not deleted
if (existing.deletedAt && !imported.deletedAt) {
  existing.deletedAt = 0;  // Undelete
}
```

### Import Validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalItems: number;
    validItems: number;
    invalidItems: number;  // Missing URL
    duplicateUrls: number; // Within import file
  };
}
```

**Validation rules**:
1. Must have `url` field
2. `url` must be valid http/https (use `isCapturableUrl`)
3. Warn on missing title (will use URL fallback)
4. Warn on duplicate URLs within file (only first imported)

---

## UI Design

### Location: Options Page

Add new section between "Troubleshooting" and "About":

```
┌─────────────────────────────────────────────────┐
│ Data                                            │
├─────────────────────────────────────────────────┤
│                                                 │
│ Export Bookmarks                                │
│ Download your bmbl bookmarks as a file.         │
│                                                 │
│ ☐ Include hidden items                          │
│                                                 │
│ [Export JSON]  [Export HTML] (Phase 2)          │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ Import Bookmarks                                │
│ Import bookmarks from a file.                   │
│                                                 │
│ [Choose File]  or drag & drop                   │
│                                                 │
│ Supported: .json (bmbl), .html (browser export) │
│                                                 │
│ When URL already exists:                        │
│ ○ Skip (keep existing)                          │
│ ○ Merge (combine metadata)                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Export Flow

1. User clicks "Export JSON"
2. Generate JSON blob from IndexedDB
3. Trigger download via `<a download="...">` or `URL.createObjectURL`
4. Show success toast: "Exported 150 bookmarks"

### Import Flow

1. User clicks "Choose File" or drags file
2. Validate file format and contents
3. Show preview: "Found 75 bookmarks. 10 already exist."
4. User confirms import
5. Process items (with progress for large files)
6. Show result: "Imported 65 new, skipped 10 duplicates"

---

## Technical Implementation

### Export Implementation

```typescript
// src/lib/export/exportJson.ts
import { db } from '@/lib/db/schema';
import { NOT_DELETED } from '@/types';

interface ExportOptions {
  includeHidden: boolean;
}

export async function exportToJson(options: ExportOptions): Promise<Blob> {
  // Query items
  let query = db.items.toCollection();
  if (!options.includeHidden) {
    query = db.items.where('deletedAt').equals(NOT_DELETED);
  }
  const items = await query.toArray();

  // Transform to export format
  const exportData: BmblExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: {
      extensionVersion: chrome.runtime.getManifest().version,
      browser: 'chrome', // Could detect via userAgent
    },
    options: {
      includeHidden: options.includeHidden,
    },
    stats: {
      totalItems: items.length,
      favoriteCount: items.filter(i => i.favoritedAt > 0).length,
      hiddenCount: items.filter(i => i.deletedAt > 0).length,
    },
    items: items.map(item => ({
      url: item.url,
      title: item.title,
      domain: item.domain,
      createdAt: item.createdAt,
      lastSavedAt: item.lastSavedAt,
      saveCount: item.saveCount,
      ...(item.favoritedAt > 0 && { favoritedAt: item.favoritedAt }),
      ...(item.deletedAt > 0 && { deletedAt: item.deletedAt }),
    })),
  };

  return new Blob(
    [JSON.stringify(exportData, null, 2)],
    { type: 'application/json' }
  );
}

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
```

### Import Implementation

```typescript
// src/lib/import/importJson.ts
import { db } from '@/lib/db/schema';
import { normalizeUrl, extractDomain, isCapturableUrl } from '@/lib/utils/url';
import { generateId } from '@/lib/utils/uuid';
import { NOT_DELETED, NOT_FAVORITED, NOT_OPENED } from '@/types';

interface ImportOptions {
  conflictStrategy: 'skip' | 'merge';
}

interface ImportResult {
  imported: number;
  skipped: number;
  merged: number;
  errors: string[];
}

export async function importFromJson(
  data: BmblExport,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    merged: 0,
    errors: [],
  };

  await db.transaction('rw', db.items, async () => {
    for (const item of data.items) {
      // Validate URL
      if (!item.url || !isCapturableUrl(item.url)) {
        result.errors.push(`Invalid URL: ${item.url}`);
        continue;
      }

      const normalizedUrl = normalizeUrl(item.url);
      const existing = await db.items
        .where('normalizedUrl')
        .equals(normalizedUrl)
        .first();

      if (existing) {
        if (options.conflictStrategy === 'skip') {
          result.skipped++;
          continue;
        }

        // Merge
        await db.items.update(existing.itemId, {
          saveCount: existing.saveCount + (item.saveCount || 1),
          lastSavedAt: Math.max(existing.lastSavedAt, item.lastSavedAt || 0),
          createdAt: Math.min(existing.createdAt, item.createdAt || Date.now()),
          favoritedAt: existing.favoritedAt || item.favoritedAt || NOT_FAVORITED,
          deletedAt: item.deletedAt ? existing.deletedAt : NOT_DELETED,
          updatedAt: Date.now(),
        });
        result.merged++;
      } else {
        // Insert new
        const now = Date.now();
        await db.items.add({
          itemId: generateId(),
          url: item.url,
          normalizedUrl,
          title: item.title || extractDomain(item.url),
          domain: item.domain || extractDomain(item.url),
          favIconUrl: null, // Don't import stale favicons
          createdAt: item.createdAt || now,
          lastSavedAt: item.lastSavedAt || now,
          saveCount: item.saveCount || 1,
          favoritedAt: item.favoritedAt || NOT_FAVORITED,
          deletedAt: item.deletedAt || NOT_DELETED,
          lastOpenedAt: NOT_OPENED,
          updatedAt: now,
        });
        result.imported++;
      }
    }
  });

  return result;
}
```

### HTML Import (Phase 2)

```typescript
// src/lib/import/importHtml.ts

interface ParsedBookmark {
  url: string;
  title: string;
  addDate?: number;
}

export function parseNetscapeBookmarks(html: string): ParsedBookmark[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = doc.querySelectorAll('a[href]');

  const bookmarks: ParsedBookmark[] = [];

  links.forEach(link => {
    const url = link.getAttribute('href');
    if (!url || !isCapturableUrl(url)) return;

    const title = link.textContent?.trim() || '';
    const addDateStr = link.getAttribute('add_date');
    const addDate = addDateStr ? parseInt(addDateStr, 10) * 1000 : undefined;

    bookmarks.push({ url, title, addDate });
  });

  return bookmarks;
}
```

---

## File Structure

```
src/lib/
├── export/
│   ├── index.ts
│   ├── exportJson.ts
│   └── exportHtml.ts      (Phase 2)
├── import/
│   ├── index.ts
│   ├── importJson.ts
│   ├── importHtml.ts      (Phase 2)
│   └── validate.ts
```

---

## Security Considerations

1. **File validation**: Always validate imported files
   - Check `version` field matches expected
   - Validate all URLs with `isCapturableUrl`
   - Sanitize titles (though React escapes by default)
   - Limit file size (e.g., 10MB max)

2. **No executable content**: JSON/HTML bookmark files contain no code
   - Never `eval()` imported content
   - Parse with `JSON.parse` / `DOMParser` only

3. **No network requests during import**: Don't fetch favicons or validate URLs exist
   - Import is offline operation
   - Favicons fetched lazily on visit

4. **Privacy**: Export file may contain sensitive URLs
   - Warn user if exporting to location outside extension
   - Consider offering encryption option (future)

---

## Edge Cases

1. **Large exports (10,000+ items)**
   - Stream JSON writing instead of building full string
   - Show progress indicator during import
   - Use transaction batching (100 items per batch)

2. **Corrupt/incomplete JSON**
   - Wrap `JSON.parse` in try/catch
   - Validate schema before processing
   - Report specific validation errors

3. **Mixed content (http:// items)**
   - Import both http and https
   - Normalization handles protocol in dedupe

4. **Duplicate URLs within import file**
   - First occurrence wins
   - Warn user in validation summary

5. **Empty file**
   - Validate `items.length > 0`
   - Show helpful error message

---

## Phased Implementation

### Phase 1: JSON Export/Import (MVP)
- Export all items as JSON
- Import bmbl JSON files
- Basic UI in options page
- ~2 days implementation

### Phase 2: HTML Support
- Export as Netscape HTML
- Import browser bookmark exports
- ~1 day additional

### Phase 3: Enhanced UX
- Drag-and-drop import
- Progress indicator for large files
- Import preview with conflict summary
- ~1 day additional

### Future Considerations
- Encrypted export (password protected)
- Cloud sync (Google Drive, Dropbox)
- Chrome bookmarks API integration (`chrome.bookmarks` permission)
- Scheduled automatic backups

---

## Open Questions

1. **Should settings be exported with items?**
   - Recommendation: Separate "Export Settings" button, keeps concerns clean

2. **Should we support partial export (date range, view filter)?**
   - Recommendation: Not in MVP. "Export All" covers 90% of use cases.

3. **Should import auto-refresh the newtab view?**
   - Recommendation: Yes, send message to trigger refresh after import completes

4. **What about the `bookmarks` permission for Chrome native integration?**
   - Recommendation: Avoid for now. Adds scary permission prompt, limited benefit over HTML import.
