# Bookmark Backlog (bmbl) — Product & Technical Spec (Markdown)

**Document status:** Draft v1 (for design + engineering handoff)
**Target:** Chrome Extension (Manifest V3)
**Primary surfaces:** Toolbar action (one-click capture), New Tab page (HN-style home)

---

## Table of contents

1. [Overview](#overview)
2. [Goals and non-goals](#goals-and-non-goals)
3. [Glossary](#glossary)
4. [User stories](#user-stories)
5. [User experience](#user-experience)
6. [Information architecture](#information-architecture)
7. [Core flows](#core-flows)
8. [UI spec](#ui-spec)
9. [Data model](#data-model)
10. [Dedupe, delete, priority rules](#dedupe-delete-priority-rules)
11. [URL filtering and normalization](#url-filtering-and-normalization)
12. [Extension architecture](#extension-architecture)
13. [Permissions](#permissions)
14. [Storage strategy (IndexedDB + settings)](#storage-strategy-indexeddb--settings)
15. [Styling and design](#styling-and-design)
16. [Performance and reliability](#performance-and-reliability)
17. [Privacy and security](#privacy-and-security)
18. [Testing plan](#testing-plan)
19. [Project structure](#project-structure)
20. [Future roadmap](#future-roadmap)
21. [Implementation decisions](#implementation-decisions)

---

## Overview

**Bookmark Backlog (bmbl)** is a Chrome extension that lets users “bookmark” *all currently open tabs across all open windows* (within the active Chrome profile), then surfaces those saved links in a **Hacker News–style New Tab homepage**.

The key interaction is:

* **One click** → save all open tabs
* **New Tab** → see your saved backlog, sorted and triaged via **priority (upvotes)** and **soft-delete**

The long-term vision includes optional syncing, optional Chrome-bookmarks mirroring, and a per-link details page that links to relevant discussions (HN/Reddit/etc.).

---

## Goals and non-goals

### Goals (V1 / prototype)

* One-click capture of **all tabs** across **all windows**
* New Tab override that displays:

  * list view (HN-style)
  * sorting (newest / oldest / priority / frequency)
  * per-item soft-delete
  * per-item priority score (upvotes)
* Dedupe globally by normalized URL
* Preserve **tab group metadata** (group name/color) in schema (even if not heavily used yet)
* Settings:

  * Auto-close after save (default OFF)
  * Auto-close excludes pinned tabs
* Filter out internal/non-web URLs (e.g., `chrome://`, `chrome-extension://`, `file://`)

### Non-goals (explicitly out of scope for V1)

* Full-text search (may come later)
* Tags/folders/user-defined collections (later)
* Per-item discussion fetching and embedding (later)
* Chrome bookmarks integration (later, optional “hybrid”)
* Cloud sync (later, optional)

---

## Glossary

* **Capture**: A single “Save all tabs” action.
* **Capture batch / session**: The metadata for a capture event (createdAt, counts, etc.).
* **Item / Backlog item**: A deduped record representing a URL in the backlog.
* **Capture event**: The relationship record that says: “this item appeared in capture X,” including window/tab metadata and group info.
* **Soft delete**: Hide an item (tombstone via `deletedAt`), not a hard delete.
* **Priority score**: Integer score the user can increment/decrement (“upvotes”).

---

## User stories

### Capture

* As a user, I can click once to save all open tabs so I can clear my mental backlog.
* As a user, I can choose to auto-close tabs after saving so I can declutter my browser.
* As a user, I can keep pinned tabs open even when auto-close is enabled.

### Review / triage

* As a user, when I open a New Tab I see my backlog immediately, in a readable, minimal list.
* As a user, I can sort my backlog by newest/oldest.
* As a user, I can upvote items to mark them as priority reading.
* As a user, I can hide items I no longer care about with one click.
* As a user, I can view hidden items and restore them if needed.

### Dedupe / frequency

* As a user, when I save tabs multiple times, I don’t get repeated duplicate rows; the system dedupes.
* As a user, I can see that I’ve saved certain pages many times (frequency) and use that insight to hide/ignore them.

### Compatibility

* As a user, bmbl always replaces my New Tab page (non-incognito).
* As a user, if another extension blocks bmbl from becoming New Tab, I’m told how to fix it.

---

## User experience

### Principles

* **Fast and minimal**: list-first UI that loads instantly on New Tab.
* **HN-style readability**: information-dense, low chrome.
* **One-click**: capture should be “it just worked.”
* **Local-first**: data stays local (until optional sync later).

### States

* **Empty state**: no saved items → show “Click bmbl to save all tabs” plus a short explainer.
* **Loaded state**: show list with sorting + nav.
* **Error state**: show a minimal banner: “Something went wrong loading your backlog. Try refreshing.”

---

## Information architecture

### Primary navigation (top bar, HN-like)

* `bmbl` (logo / home)
* `new` (default view)
* `old`
* `priority`
* `frequent`
* `hidden`
* `settings` (link to Options/Settings route)

### Default view

* **new**: items not deleted, sorted by most recently saved

---

## Core flows

### Flow 1 — Save all tabs

**Trigger:** user clicks toolbar icon (extension action)

**Steps:**

1. Query all windows + all tabs
2. Filter out internal/non-web URLs (see filtering rules)
3. Create a new `captureId` and insert capture metadata
4. For each remaining tab:

   * compute normalized URL
   * upsert into `items` store (global dedupe)
   * write a `captureEvent` record (for group/window metadata)
5. If `autoCloseAfterSave` is ON:

   * close captured tabs **excluding pinned tabs**
   * (optional) also exclude tabs with internal/non-web URLs since we didn’t capture them
6. Provide a small feedback mechanism:

   * badge count update *or* toast in New Tab (see UI notes)
   * capture summary: “Saved X tabs (skipped Y internal; updated Z existing)”

**Acceptance criteria:**

* Captures across **multiple windows**
* Captures pinned tabs (as items), but does **not** close pinned tabs when auto-close is enabled
* Does not store `chrome://`, `chrome-extension://`, `file://` etc.
* Creates/updates items with dedupe behavior (no duplicates in list)

---

### Flow 2 — Triage on New Tab

**Trigger:** user opens a new tab

**Steps:**

1. Load items from IndexedDB (first page)
2. Render list (default sorting “new”)
3. User can:

   * open item
   * upvote / downvote (score)
   * hide (soft-delete)
   * change sort/view

**Acceptance criteria:**

* List loads quickly (target: first render under ~200ms on typical dataset)
* Actions are instant (optimistic UI); DB updates persist on refresh

---

### Flow 3 — Hide and restore

**Hide**

* User clicks “hide” (trash icon)
* Item disappears from main list immediately
* Item appears in “hidden” view
* Optional toast: “Hidden. Undo” (Undo restores item)

**Restore**

* In hidden view, user clicks “restore”
* Item returns to lists with original scores/frequency intact

**Acceptance criteria:**

* Hidden items do not resurface automatically when captured again (default policy)

---

## UI spec

### New Tab page layout (HN-style)

#### Header / Top nav

* Left: `bmbl`
* Nav links: `new | old | priority | frequent | hidden | settings`
* Right side (optional in V1): capture summary like “Last save: 2m ago”

#### List row (item)

Each row should contain:

**Line 1**

* `rank` (1., 2., 3. … based on current sort page)
* Title (clickable)
* `(domain.com)` lighter text, clickable optional

**Line 2 (metadata/actions)**

* `saved: 2h ago` (based on `lastSavedAt`)
* `count: 7` (saveCount; optional in default view, required in “frequent” view)
* `score: 3` (priority score; show as number)
* actions:

  * upvote (increment score)
  * downvote (decrement score, min 0)
  * hide (soft delete)

#### Interaction rules

* **Title click**: opens URL in a **new tab** (preserves backlog view)
* **Middle-click / cmd-click**: default browser behavior (open in new tab)
* **Upvote**: `score += 1`
* **Downvote**: `score = max(0, score - 1)`
* **Hide**: `deletedAt = now` (soft delete); shows "Hidden. Undo" toast for 5 seconds

#### Empty state

* Big message: “No saved tabs yet.”
* Button: “Save all open tabs” (triggers capture)

  * Note: this button on New Tab calls the same capture logic as toolbar action.
* Short explainer: “Click once to save all tabs into a reading backlog.”

#### Loading state

* Minimal skeleton rows (5–10)
* No spinners that block the whole page

---

### Views and sorting

#### Views

* **new**: `deletedAt == null`, sort by `lastSavedAt desc`
* **old**: `deletedAt == null`, sort by `lastSavedAt asc`
* **priority**: `deletedAt == null AND score > 0`, sort by `score desc, lastSavedAt desc`
* **frequent**: `deletedAt == null`, sort by `saveCount desc, lastSavedAt desc`
* **hidden**: `deletedAt != null`, sort by `deletedAt desc` (or `lastSavedAt desc`)

#### Pagination / infinite scroll

* Load first **30 items** (matches Hacker News)
* Load more 30 on scroll
* Prefer list virtualization if dataset grows large (500+ items)

#### Fallback behaviors

* **Missing favicon**: show Globe icon (from lucide-react)
* **Missing title**: show domain + path as title

---

### Settings (Options page)

#### Settings list (V1)

* **Auto-close after save** (toggle)

  * default OFF
  * help text: “When enabled, bmbl will close saved tabs after capturing them. Pinned tabs are never closed.”
* (Optional V1.1) **Resurface hidden items if captured again** (toggle)

  * default OFF

#### Troubleshooting section

* “If bmbl is not showing on New Tab, another extension may be controlling New Tab. Disable other New Tab extensions.”

---

## Data model

> Canonical store is IndexedDB via **Dexie.js**. Database name: `bmbl`. Settings use `chrome.storage.sync` (so settings can sync later without syncing the whole backlog).

### Object stores

#### `items` (canonical deduped items)

Key: `itemId` (UUID)

Fields:

* `itemId: string`
* `url: string` (most recent raw URL)
* `normalizedUrl: string` (dedupe identity; unique)
* `title: string`
* `domain: string`
* `favIconUrl?: string | null`
* `createdAt: number` (first time seen)
* `lastSavedAt: number` (most recent time captured)
* `saveCount: number` (times captured; increments on recapture)
* `score: number` (integer priority score; default 1, min 0)
* `deletedAt?: number | null` (soft delete tombstone)
* `lastOpenedAt?: number | null` (optional; for future ranking)
* `updatedAt: number` (future sync-friendly)

Recommended indexes:

* `normalizedUrl` (unique)
* `lastSavedAt`
* `saveCount`
* `score`
* `deletedAt`
* `updatedAt`

---

#### `captures` (batch metadata)

Key: `captureId` (UUID)

Fields:

* `captureId: string`
* `createdAt: number`
* `tabCountCaptured: number`
* `tabCountSkippedInternal: number`
* `tabCountUpdatedExisting: number`
* `tabCountInsertedNew: number`
* `tabCountAlreadyDeleted: number` (captured again but item remained hidden)
* `autoCloseEnabled: boolean`

Indexes:

* `createdAt`

---

#### `captureEvents` (join table: capture ↔ item)

Key: compound `[captureId, itemId]` (prevents duplicates, ensures data integrity)

Fields:

* `captureId: string`
* `itemId: string`
* `capturedAt: number`
* `windowId: number`
* `tabId?: number | null` (debugging only; ephemeral)
* `pinned: boolean`
* `groupId?: number | null`
* `groupTitle?: string | null`
* `groupColor?: string | null`

Indexes:

* `captureId`
* `itemId`
* `capturedAt`
* (Optional) `groupTitle`

---

## Dedupe, delete, priority rules

### Global dedupe rule

* Two tabs are considered the same backlog item if `normalizedUrl` matches.

### Upsert behavior on capture

When capturing a tab with `normalizedUrl`:

**If item does not exist**

* Create item:

  * `createdAt = now`
  * `lastSavedAt = now`
  * `saveCount = 1`
  * `score = 1` (default starting score)
  * `deletedAt = null`

**If item exists and is NOT deleted**

* Update item:

  * `lastSavedAt = now`
  * `saveCount += 1`
  * Update `title`, `url`, `favIconUrl` (use latest from tab)
  * Keep `score` as-is
  * `updatedAt = now`

**If item exists and IS deleted**

* Update item:

  * `lastSavedAt = now`
  * `saveCount += 1`
  * Update `title`, `url`, `favIconUrl` (optional; recommend yes)
  * Keep `deletedAt` intact (**do not resurrect by default**)
  * `updatedAt = now`
* Increment capture metric: `tabCountAlreadyDeleted`

> Rationale: repeated “standard pages” should stay hidden once user hides them, even if the user keeps re-saving all tabs.

### Soft delete rule

* Hide action sets `deletedAt = now`
* Item removed from main lists immediately
* Hidden view shows the item with restore action

### Restore rule

* Restore action sets `deletedAt = null`
* Item returns to lists with same `score` and `saveCount`

### Priority score rules

* Score is an integer, `default = 1`, `min = 0`, no fixed max.
* Upvote increments by 1.
* Downvote decrements by 1 (but never below 0).
* In priority view, show score prominently.

---

## URL filtering and normalization

### Filtering (capture allowlist)

Only store URLs where:

* protocol is `http:` or `https:`

Explicitly skip:

* `chrome://*`
* `chrome-extension://*`
* `file://*`
* `about:*`
* any other non-http(s) protocols

### Normalization algorithm (V1)

Given `url`:

1. Parse using `new URL(url)`
2. Set:

   * `protocol = url.protocol`
   * `hostname = url.hostname.toLowerCase()`
   * `pathname = url.pathname` (optionally remove trailing `/` if not root)
   * `search = url.search` (V1 keeps query string by default)
3. Remove fragment:

   * `hash = ''`
4. Recompose `normalizedUrl`:

   * `${protocol}//${hostname}${pathname}${search}`

**Optional V1.1 improvement (tracking params)**

* Remove `utm_*`, `fbclid`, etc. from query string.

### Domain extraction

* `domain = hostname` with `www.` stripped for display
* Display domain only (no path) next to title, matching Hacker News style: `(example.com)`

---

## Extension architecture

### Manifest V3 components

#### 1) Background service worker

Responsibilities:

* Handle toolbar action click (“Save all tabs”)
* Read settings (auto-close toggle)
* Query all windows/tabs + tab groups
* Write to IndexedDB
* Close tabs when auto-close is enabled (excluding pinned)

#### 2) New Tab override page

Responsibilities:

* Render HN-style UI
* Read from IndexedDB via a shared DAL (data access layer)
* Apply view filters and sorting
* Trigger capture from UI button (same action as toolbar)
* Handle item actions (score changes, hide, restore)

#### 3) Options page

Responsibilities:

* Manage settings (stored in `chrome.storage.sync`)
* Provide troubleshooting info

### Data Access Layer (DAL)

Create a shared module (usable by service worker + New Tab page), e.g.:

* `db.open()` / migrations
* `items.upsertFromTab(tab, groupMeta, captureId)`
* `captures.create(captureSummary)`
* `captureEvents.insert(event)`
* `items.list({view, sort, limit, offset})`
* `items.setScore(itemId, score)` / `items.incrementScore(itemId)` / `items.decrementScore(itemId)`
* `items.softDelete(itemId)` / `items.restore(itemId)`

Implementation:

* Use **Dexie.js** for IndexedDB with built-in migrations + query builder.
* Keep DB logic centralized to avoid divergent behavior.
* Open fresh DB connection per operation (simple/robust for MV3 service worker lifecycle).

### Message passing

**Chosen approach: capture always runs in service worker**

* New Tab page sends a message `CAPTURE_ALL_TABS`
* Service worker runs capture and replies with summary
* Single source of truth for capture logic

### Capture behavior

* **Debouncing**: Ignore subsequent clicks while capture is in progress; show loading icon state
* **Transaction scope**: One atomic IndexedDB transaction per capture
* **Pending tabs**: Capture as-is (don't wait for tabs to finish loading)
* **Large tab counts**: Let it run without progress UI; optimize later if needed

### Icon states

The extension icon changes during capture:
1. **Default**: Normal bmbl icon
2. **Capturing**: Loading/spinner icon (static, not animated)
3. **Success**: Checkmark icon for 5 seconds, then returns to default

---

## Permissions

### Required (V1)

* `tabs` — needed to read URLs/titles for all open tabs across windows
* `tabGroups` — needed to read group name/color metadata
* `storage` — store settings (and possibly lightweight cache)
* `unlimitedStorage` — ensures storage headroom for long-lived backlog growth
* `chrome_url_overrides.newtab` — New Tab replacement

### Not required (V1)

* `bookmarks` — deferred until optional mirroring later
* broad host permissions — deferred until discussion fetching (HN/Reddit) is implemented

---

## Storage strategy (IndexedDB + settings)

### IndexedDB (canonical)

* Stores: `items`, `captures`, `captureEvents`
* Designed for:

  * fast sorted reads via indexes
  * large datasets
  * future sync compatibility

### chrome.storage.sync (settings only)

**Initialization**: On extension install (`chrome.runtime.onInstalled`) + migration for new settings in updates.

Example settings keys:

* `autoCloseAfterSave: boolean` (default false)
* `resurfaceHiddenOnRecapture: boolean` (default false; likely V1.1)
* `defaultView: "new" | "old" | "priority" | "frequent"` (default "new") — controls which view loads on new tab
* `uiDensity: "comfortable" | "compact"` (optional)

---

## Styling and design

### Color palette

* **Header bar**: Purple (instead of HN's orange #ff6600)
* **Background**: Off-white #f6f6ef (matching HN)
* **Dark mode**: Supported in V1 (invert colors appropriately)

### Typography

* **Font**: Verdana, Geneva, sans-serif (matching HN exactly)
* **Density**: Compact, similar to Hacker News

### Responsive

* Responsive layout similar to Hacker News
* Minimum supported width: reasonable desktop/laptop viewport
* Mobile browser extensions are out of scope for V1

---

## Performance and reliability

### Performance targets

* New Tab first meaningful render: **fast enough to feel instant**
* List reads are indexed and paginated (limit + offset)
* Avoid network calls on New Tab load

### Reliability / resilience

* DB schema versioning + migrations
* Defensive parsing:

  * invalid URL parsing should be skipped and counted as “skipped invalid”
* Capture should never partially corrupt state:

  * use one atomic transaction for entire capture (Dexie.js transaction)
* If IndexedDB fails to open:

  * show error state with fallback instructions:

    * “Try reloading”
    * “If persists, export (future) / reinstall extension (data will be lost)”

---

## Privacy and security

### Privacy stance (V1)

* Local-only storage (no servers)
* No remote fetching
* No content script injection into pages
* Only store:

  * URL, title, favicon URL, timestamps, counters, group metadata

### Security notes

* Do not execute untrusted HTML (titles/domains must be escaped)
* Use Content Security Policy defaults for MV3 pages
* Keep permissions minimal (no host permissions unless required later)

---

## Testing plan

### Unit tests

* URL normalization:

  * strips hash
  * lowercases hostname
  * filters non-http(s)
* Upsert logic:

  * new item created correctly
  * existing item updated correctly
  * deleted item does not resurrect
* Score logic:

  * never below 0

### Integration tests (manual + automated where possible)

* Capture across multiple windows
* Capture with pinned tabs (pinned captured, not auto-closed)
* Auto-close ON:

  * closes only non-pinned captured tabs
* Tab groups:

  * group title/color captured into captureEvents
* New Tab UI:

  * sorting works
  * hide/restore works
  * score changes persist after refresh

### UX checks

* New tab override conflict troubleshooting copy is clear
* Empty state drives user to the one-click action

---

## Project structure

WXT + React + TypeScript folder structure:

```
src/
  entrypoints/
    background.ts          # Service worker
    newtab/                # New tab page
      index.html
      main.tsx
    options/               # Settings page
      index.html
      main.tsx
  components/              # Shared React components
  lib/
    db/                    # IndexedDB DAL (Dexie.js)
    capture/               # Capture logic
    utils/                 # URL normalization, etc.
  hooks/                   # Custom React hooks
  types/                   # TypeScript types
```

**Shared code**: DAL is shared between background + newtab. Types shared everywhere. Components shared between newtab + options.

---

## Future roadmap

### V1.1 (quality of life)

* “Undo” toast on hide
* Optional setting: “Resurface hidden items if captured again”
* Tracking param stripping (`utm_*`, etc.)
* Batch/session view (read from `captures` + `captureEvents`)
* Export/Import JSON (manual sync)

### V2 (discussion + detail pages)

* Per-item detail page:

  * item metadata
  * links to search discussions
* Client-side discussion links (no embed):

  * “Search on HN”
  * “Search on Reddit”
* Later: embedded HN results (requires host permissions + fetch)

### V3 (sync + bookmarks hybrid)

* Optional cloud sync (single-user)

  * outbox mutations
  * pull/push with last-write-wins
* Optional Chrome bookmarks mirroring

  * create bmbl folders
  * store `bookmarkId` mapping per item
  * maintain index in IndexedDB for dedupe + soft-delete + score

---

## Implementation decisions

> Quick reference for all decisions made during spec review.

### Data layer
| Decision | Choice |
|----------|--------|
| IndexedDB wrapper | Dexie.js |
| Database name | `bmbl` |
| captureEvents key | Compound `[captureId, itemId]` |
| Transaction scope | One atomic transaction per capture |

### Capture behavior
| Decision | Choice |
|----------|--------|
| Debouncing | Ignore clicks while capture in progress |
| Large tab counts | Let it run, optimize later if needed |
| Message passing | Capture runs in service worker |
| Pending tabs | Capture as-is |

### UI/UX
| Decision | Choice |
|----------|--------|
| Page size | 30 items (matches HN) |
| Link click | Opens in new tab |
| Default score | 1 point |
| Domain display | Strip `www.`, show domain only (no path) |
| Undo toast | 5 seconds |
| Favicon fallback | Globe icon |
| Title fallback | Domain + path |
| Long titles | Match HN (truncation/wrap) |
| Favicons | Show them |
| Recency format | "2h ago" style |
| List density | Compact (match HN) |

### Extension icon
| Decision | Choice |
|----------|--------|
| Badge | None (icon only) |
| Icon states | Default → Loading → Success (5s) → Default |

### Settings
| Decision | Choice |
|----------|--------|
| Initialization | On install + migration for new settings |
| `defaultView` | Controls which view loads on new tab |

### Styling
| Decision | Choice |
|----------|--------|
| Header color | Purple (not HN orange) |
| Background | Off-white #f6f6ef |
| Dark mode | Supported in V1 |
| Typography | Verdana (match HN exactly) |
| Responsive | Yes, similar to HN |

### Deferred to future
| Item | Notes |
|------|-------|
| Incognito mode | Consider in future update |
| Mobile browsers | Out of scope |

---

## Design deliverables (requested screens)

1. **New Tab — “new” view (default)**
2. **New Tab — “priority” view**
3. **New Tab — “frequent” view**
4. **New Tab — “hidden” view**
5. **Empty state**
6. **Settings page**
7. **Optional: capture confirmation banner/toast designs**
8. **Optional: conflict troubleshooting panel copy block**

---

## Engineering deliverables (V1 checklist)

* [ ] MV3 extension scaffold (action + service worker + newtab override + options)
* [ ] Settings storage (`chrome.storage.sync`) with defaults
* [ ] IndexedDB schema + migrations
* [ ] Capture pipeline:

  * [ ] query all tabs across all windows
  * [ ] filter internal URLs (http/https only)
  * [ ] gather tab group metadata
  * [ ] upsert items w/ dedupe + saveCount
  * [ ] write captures + captureEvents
  * [ ] auto-close (optional) excluding pinned
* [ ] New Tab UI:

  * [ ] views + sorting
  * [ ] score controls
  * [ ] hide/restore
  * [ ] pagination/infinite scroll
* [ ] Basic onboarding/troubleshooting copy

