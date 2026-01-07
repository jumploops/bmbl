# bmbl — Bookmark Backlog

**Save all tabs with one click. Triage your reading backlog.**

bmbl is a Chrome extension that captures all open tabs across all windows and displays them in a Hacker News-style new tab page. No more tab hoarding anxiety—just click once to save everything, then review and prioritize at your own pace.

<p align="center">
  <img src="public/screenshots/bmbl_demo.gif" alt="bmbl demo" width="800">
</p>

## Features

- **One-click capture**: Save all open tabs across all windows instantly
- **HN-style interface**: Clean, information-dense list view
- **Smart deduplication**: Same URL saved multiple times? It's tracked, not duplicated
- **Favorites**: Star items to add them to your favorites
- **Multiple views**: Sort by newest, oldest, favorites, or frequency
- **Soft delete**: Hide items you don't need; restore them anytime
- **Tab group support**: Captures Chrome tab group metadata
- **Dark mode**: System, light, or dark theme options
- **Local-first**: All data stays in your browser (IndexedDB)

## Tech Stack

- **[WXT](https://wxt.dev/)** — Modern web extension framework
- **React 19** + **TypeScript**
- **Tailwind CSS v4** — Styling
- **Dexie.js** — IndexedDB wrapper
- **lucide-react** — Icons
- **date-fns** — Time formatting

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/bmbl.git
cd bmbl

# Install dependencies
pnpm install
```

---

## Development

### Start Development Server

```bash
pnpm dev
```

This starts the WXT development server with hot reload. The extension will be built to `.output/chrome-mv3/`.

### Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3` folder in your project directory

The extension should now appear in your toolbar.

### Development Workflow

1. **Make changes** to source files in `src/`
2. **WXT auto-rebuilds** on save (watch mode)
3. **Refresh the extension** in `chrome://extensions` (click the refresh icon on the bmbl card)
4. **Test your changes**:
   - Open a new tab to see the new tab page
   - Click the extension icon to trigger a capture
   - Right-click the icon → Options to see the settings page

### Hot Reload Behavior

- **New tab page**: Refresh the new tab to see changes
- **Options page**: Refresh the options page
- **Service worker**: Click the refresh button in `chrome://extensions`

### Useful Chrome URLs

| URL | Purpose |
|-----|---------|
| `chrome://extensions` | Manage extensions, reload, view errors |
| `chrome://extensions/?errors` | View extension errors |
| `chrome://newtab` | Your new tab page (bmbl's main UI) |

---

## Testing

### Run Unit Tests

```bash
pnpm test           # Run tests once
pnpm test:watch     # Run tests in watch mode
```

### Type Checking

```bash
pnpm typecheck
```

### Manual Testing Checklist

#### Capture Flow
1. Open 5+ tabs (mix of http, https, chrome://, file://)
2. Click the bmbl extension icon
3. Watch the icon change: default → loading → success (5s) → default
4. Open a new tab → verify captured items appear

#### Deduplication
1. Open the same URL in multiple tabs
2. Capture
3. Verify only one item in list (saveCount should reflect multiple captures)

#### Soft Delete
1. Hide an item using the "hide" link
2. Switch to "hidden" view → item should appear there
3. Click "restore" → item returns to main views

#### Favorites
1. Click the arrow to favorite an item
2. Switch to "favorites" view → item should appear there
3. Click "unfavorite" → item is removed from favorites

#### Views
- **new**: Items sorted by most recently saved
- **old**: Items sorted oldest first
- **favorites**: Favorited items, sorted by when favorited
- **frequent**: Items sorted by save count
- **hidden**: Soft-deleted items

#### Auto-Close (when enabled in settings)
1. Enable auto-close in settings
2. Pin a tab
3. Capture
4. Verify: non-pinned tabs closed, pinned tab remains

### Inspecting IndexedDB

1. Open a new tab (bmbl's UI)
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Application** → **IndexedDB** → **bmbl**
4. Browse the `items`, `captures`, and `captureEvents` stores

### Inspecting Service Worker

1. Go to `chrome://extensions`
2. Find bmbl and click **Service Worker** link
3. DevTools opens for the background script
4. View console logs for capture events

---

## Building for Production

```bash
pnpm build          # Build for Chrome
pnpm build:firefox  # Build for Firefox

pnpm zip            # Create distributable ZIP for Chrome
pnpm zip:firefox    # Create distributable ZIP for Firefox
```

Output locations:
- Development: `.output/chrome-mv3/`
- Production ZIP: `.output/` (after `pnpm zip`)

---

## Project Structure

```
bmbl/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts          # Service worker (capture logic)
│   │   ├── newtab/                 # New tab page
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   └── App.tsx
│   │   └── options/                # Settings page
│   │       ├── index.html
│   │       ├── main.tsx
│   │       └── App.tsx
│   ├── components/                 # React components
│   │   ├── Header.tsx
│   │   ├── ItemRow.tsx
│   │   ├── ItemList.tsx
│   │   ├── ItemSkeleton.tsx
│   │   ├── EmptyState.tsx
│   │   └── ErrorState.tsx
│   ├── contexts/
│   │   └── ViewContext.tsx         # View state management
│   ├── hooks/
│   │   ├── useItems.ts             # Items data + actions
│   │   ├── useCapture.ts           # Trigger capture from UI
│   │   ├── useLastCapture.ts       # Get last capture info
│   │   └── useDarkMode.ts          # Dark mode detection
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts           # Dexie database schema
│   │   │   ├── items.ts            # Item CRUD operations
│   │   │   ├── captures.ts         # Capture CRUD operations
│   │   │   └── index.ts
│   │   ├── capture/
│   │   │   ├── capture.ts          # Main capture logic
│   │   │   ├── tabs.ts             # Tab querying
│   │   │   ├── icons.ts            # Icon state management
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── url.ts              # URL normalization
│   │   │   ├── url.test.ts         # URL tests
│   │   │   ├── time.ts             # Time formatting
│   │   │   ├── uuid.ts             # UUID generation
│   │   │   └── cn.ts               # Tailwind class merge
│   │   └── settings.ts             # chrome.storage.sync wrapper
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   └── styles/
│       └── globals.css             # Tailwind + theme
├── public/
│   └── icon/                       # Extension icons (16, 32, 48, 128px)
├── spec/
│   └── init.md                     # Product specification
├── plan/
│   └── *.md                        # Implementation plans
├── review/
│   └── *.md                        # Code review documents
├── debug/
│   └── *.md                        # Debug investigation notes
├── wxt.config.ts                   # WXT configuration
├── tsconfig.json
├── postcss.config.js
└── package.json
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Browser                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    messages    ┌──────────────────┐   │
│  │   New Tab Page  │ ◄────────────► │  Service Worker  │   │
│  │   (React UI)    │                │  (background.ts) │   │
│  └────────┬────────┘                └────────┬─────────┘   │
│           │                                  │              │
│           │ reads/writes                     │ captures     │
│           ▼                                  ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    IndexedDB                         │   │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────────┐       │   │
│  │  │  items  │  │ captures │  │ captureEvents │       │   │
│  │  └─────────┘  └──────────┘  └───────────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────┐                                       │
│  │  Options Page   │ ◄──► chrome.storage.sync (settings)   │
│  └─────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Capture**: User clicks icon → Service worker queries all tabs → Filters/normalizes URLs → Upserts to IndexedDB → Updates icon state
2. **Display**: New tab opens → React loads items from IndexedDB → Renders HN-style list
3. **Actions**: User upvotes/hides → Optimistic UI update → Persist to IndexedDB

---

## Configuration

### Manifest Permissions

The extension requires these permissions (defined in `wxt.config.ts`):

| Permission | Purpose |
|------------|---------|
| `tabs` | Read URLs and titles of all open tabs |
| `tabGroups` | Read tab group metadata (name, color) |
| `storage` | Store settings in chrome.storage.sync |
| `unlimitedStorage` | Allow large backlog storage in IndexedDB |

---

## Common Issues

### Extension not updating after changes

1. Save your changes
2. Wait for WXT to rebuild (watch the terminal)
3. Go to `chrome://extensions`
4. Click the refresh icon on the bmbl card
5. Refresh the new tab page

### "Cannot read property of undefined" errors

Make sure you've loaded the correct output folder (`.output/chrome-mv3`), not the `src` folder.

### New tab page shows different extension

Another extension may be overriding the new tab. Disable other new tab extensions or check the troubleshooting section in bmbl's settings.

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production (Chrome) |
| `pnpm build:firefox` | Build for Firefox |
| `pnpm zip` | Create distributable ZIP |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |

---

## License

MIT
