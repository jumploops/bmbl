# CLAUDE.md — Development Guidelines for Claude

This file contains project-specific instructions for Claude Code when working on this codebase.

---

## Package Manager

**Always use `pnpm`** — never use `npm` or `yarn`.

```bash
pnpm install          # Install dependencies
pnpm add <pkg>        # Add a dependency
pnpm add -D <pkg>     # Add a dev dependency
pnpm remove <pkg>     # Remove a dependency
```

---

## Tech Stack

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager | Required, not npm |
| **WXT** | Extension framework | Handles manifest, builds, hot reload |
| **Vite** | Bundler | Used internally by WXT |
| **React 19** | UI framework | With TypeScript |
| **Tailwind CSS v4** | Styling | CSS-based config, not JS |
| **Dexie.js** | IndexedDB wrapper | For local data storage |
| **lucide-react** | Icons | Not heroicons or other icon libs |
| **date-fns** | Date formatting | Not moment.js or dayjs |
| **Vitest** | Testing | Not Jest |

---

## Commands

```bash
pnpm dev              # Start dev server with hot reload
pnpm build            # Build for production
pnpm typecheck        # Run TypeScript type checking
pnpm test             # Run unit tests
pnpm test:watch       # Run tests in watch mode
```

**Always run `pnpm typecheck` and `pnpm build` after making changes** to verify no errors.

---

## Development Flow

### For New Features

1. **Plan first**: Create a markdown file in `plan/` directory describing the feature
2. **Get approval**: Review the plan before implementation
3. **Implement**: Build the feature following the plan
4. **Verify**: Run `pnpm typecheck` and `pnpm build`
5. **Test**: Run `pnpm test` and manual testing

### For Bug Fixes

1. **Document**: Create a markdown file in `debug/` directory describing:
   - The bug/error observed
   - Steps to reproduce
   - Investigation notes
   - Root cause (once found)
   - Fix approach
2. **Fix**: Implement the fix
3. **Verify**: Run `pnpm typecheck` and `pnpm build`
4. **Test**: Confirm the bug is fixed

### File Organization

```
plan/           # Feature planning documents
debug/          # Bug investigation and fix documentation
spec/           # Product specifications
src/            # Source code
scripts/        # Build/dev scripts
```

---

## Project Structure Conventions

### Source Code (`src/`)

```
src/
├── entrypoints/        # WXT entry points (background, newtab, options)
├── components/         # React components (PascalCase.tsx)
├── contexts/           # React contexts
├── hooks/              # Custom React hooks (useCamelCase.ts)
├── lib/
│   ├── db/             # Database operations (Dexie)
│   ├── capture/        # Capture logic
│   └── utils/          # Utility functions
├── types/              # TypeScript types
└── styles/             # CSS files
```

### Naming Conventions

- **Components**: `PascalCase.tsx` (e.g., `ItemRow.tsx`)
- **Hooks**: `useCamelCase.ts` (e.g., `useItems.ts`)
- **Utilities**: `camelCase.ts` (e.g., `url.ts`)
- **Types**: Exported from `src/types/index.ts`

### Import Aliases

Use `@/` alias for imports from `src/`:

```typescript
import { Item } from '@/types';
import { db } from '@/lib/db';
import { useItems } from '@/hooks/useItems';
```

---

## Code Style

### TypeScript

- Strict mode enabled
- Prefer `interface` over `type` for object shapes
- Export types from `src/types/index.ts`
- Use explicit return types on exported functions

### React

- Functional components only
- Hooks for state and effects
- Prefer named exports for components
- Use `React.ComponentProps<>` pattern (not forwardRef)

### Tailwind CSS v4

- Config is in `src/styles/globals.css` using `@theme` directive
- Use CSS variables for theming
- Custom colors defined as `--color-*` in `@theme inline`

---

## Extension-Specific Notes

### Manifest Permissions

Defined in `wxt.config.ts`. Current permissions:
- `tabs` — Read tab URLs/titles
- `tabGroups` — Read tab group metadata
- `storage` — Settings storage
- `unlimitedStorage` — Large IndexedDB storage

### Entry Points

- **background.ts**: Service worker, handles capture logic
- **newtab/**: New tab page override (main UI)
- **options/**: Settings page

### Message Passing

Communication between newtab and background uses Chrome message passing:

```typescript
// From newtab
chrome.runtime.sendMessage({ type: 'CAPTURE_ALL_TABS' });

// In background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message
  return true; // For async response
});
```

### Data Storage

- **IndexedDB** (via Dexie): Items, captures, capture events
- **chrome.storage.sync**: Settings only

---

## Testing

### Unit Tests

- Located next to source files: `*.test.ts`
- Use Vitest (`describe`, `it`, `expect`)
- Run with `pnpm test`

### Manual Testing

After changes, test in Chrome:
1. `pnpm dev` to start dev server
2. Load `.output/chrome-mv3` in `chrome://extensions`
3. Refresh extension after changes
4. Test affected functionality

---

## Common Gotchas

1. **After installing packages**: Run `pnpm build` to verify no type errors
2. **Service worker changes**: Must refresh extension in `chrome://extensions`
3. **Tailwind v4**: Uses CSS-based config, not `tailwind.config.js`
4. **Chrome APIs**: Only available in extension context, not in tests
5. **IndexedDB**: Use Dexie transactions for atomic operations

---

## Reference Files

- **Product Spec**: `spec/init.md`
- **Implementation Plans**: `plan/*.md`
- **README**: `README.md` for setup and development workflow
