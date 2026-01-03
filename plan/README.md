# bmbl Implementation Plan

This directory contains the phased implementation plan for Bookmark Backlog (bmbl), derived from the product spec in `spec/init.md`.

## Overview

bmbl is a Chrome extension (Manifest V3) that saves all open tabs with one click and displays them in a Hacker News-style new tab page for triage.

**Tech Stack:**
- WXT (extension build tooling)
- React + TypeScript
- Tailwind CSS + ShadCN
- Dexie.js (IndexedDB)
- lucide-react (icons)
- date-fns (time formatting)

---

## Phases

| Phase | Name | Scope | Description |
|-------|------|-------|-------------|
| 1 | [Project Setup](./phase-1-project-setup.md) | Small | WXT scaffold, React, Tailwind, basic manifest |
| 2 | [Data Layer](./phase-2-data-layer.md) | Medium | Dexie.js schema, DAL, URL utilities, types |
| 3 | [Capture Pipeline](./phase-3-capture-pipeline.md) | Medium | Service worker, tab capture, icon states |
| 4 | [New Tab UI](./phase-4-newtab-ui.md) | Large | Item list, views, actions, pagination |
| 5 | [Polish & Settings](./phase-5-polish-settings.md) | Small-Medium | Options page, undo toast, dark mode polish |

---

## Dependency Graph

```
Phase 1: Project Setup
    ↓
Phase 2: Data Layer
    ↓
Phase 3: Capture Pipeline ──┐
    ↓                       │
Phase 4: New Tab UI ←───────┘
    ↓
Phase 5: Polish & Settings
```

- **Phase 1** must complete before any other phase
- **Phase 2** depends on Phase 1
- **Phase 3** depends on Phase 2 (uses DAL)
- **Phase 4** depends on Phase 2 and 3 (reads data, triggers capture)
- **Phase 5** depends on all previous phases

---

## Implementation Order

### Recommended Sequence

1. **Phase 1** → Get the project running, verify extension loads
2. **Phase 2** → Build data layer, run unit tests
3. **Phase 3** → Implement capture, test with console
4. **Phase 4** → Build UI, full end-to-end testing
5. **Phase 5** → Add settings, undo toast, polish

### Parallel Work (Optional)

If multiple developers are working:
- **Dev A**: Phase 1 → Phase 2 → Phase 3
- **Dev B**: (wait for Phase 2) → Phase 4 (can start UI components while Phase 3 progresses)
- **Both**: Phase 5 together

---

## Key Files by Phase

### Phase 1
```
wxt.config.ts
tailwind.config.js
src/styles/globals.css
src/entrypoints/background.ts
src/entrypoints/newtab/
src/entrypoints/options/
```

### Phase 2
```
src/types/index.ts
src/lib/db/schema.ts
src/lib/db/items.ts
src/lib/db/captures.ts
src/lib/utils/url.ts
src/lib/settings.ts
```

### Phase 3
```
src/lib/capture/capture.ts
src/lib/capture/tabs.ts
src/lib/capture/icons.ts
src/hooks/useCapture.ts
public/icon/*.png
```

### Phase 4
```
src/components/Header.tsx
src/components/ItemRow.tsx
src/components/ItemList.tsx
src/components/EmptyState.tsx
src/contexts/ViewContext.tsx
src/hooks/useItems.ts
```

### Phase 5
```
src/components/Toast.tsx
src/contexts/ToastContext.tsx
src/components/ui/Toggle.tsx
src/hooks/useSettings.ts
src/entrypoints/options/App.tsx
```

---

## V1 Feature Checklist

Core features to verify after all phases complete:

### Capture
- [ ] One-click save all tabs (toolbar icon)
- [ ] One-click save from empty state button
- [ ] Skip internal URLs (chrome://, file://, etc.)
- [ ] Dedupe by normalized URL
- [ ] Capture tab group metadata
- [ ] Icon states: default → loading → success (5s) → default
- [ ] Auto-close (when enabled, respects pinned tabs)

### New Tab UI
- [ ] HN-style layout with purple header
- [ ] Navigation: new | old | priority | frequent | hidden | settings
- [ ] Item display: rank, favicon, title, domain, score, time
- [ ] Upvote/downvote (optimistic UI)
- [ ] Hide with undo toast
- [ ] Restore from hidden view
- [ ] Infinite scroll pagination
- [ ] Empty state with capture button
- [ ] Loading skeleton
- [ ] Error state with retry

### Settings
- [ ] Auto-close toggle
- [ ] Default view select
- [ ] Troubleshooting section
- [ ] Settings persist across sessions

### Polish
- [ ] Dark mode (system preference)
- [ ] Verdana typography
- [ ] Responsive layout

---

## Testing Strategy

### Unit Tests (Phase 2)
- URL normalization
- URL filtering
- Domain extraction

### Integration Tests (Manual)
- Capture across multiple windows
- Capture with tab groups
- Dedupe behavior
- Soft delete respects recapture
- Auto-close respects pinned tabs

### E2E Smoke Test
1. Install extension
2. Open 5+ tabs (mix of URLs)
3. Click extension icon
4. Open new tab → see items
5. Upvote an item
6. Hide an item → undo
7. Check hidden view
8. Change settings
9. Verify settings apply

---

## Reference

- **Product Spec**: [`spec/init.md`](../spec/init.md)
- **Implementation Decisions**: See "Implementation decisions" section in spec

---

## Notes

- Each phase has its own acceptance criteria and testing checklist
- Complete one phase fully before moving to the next
- Mark items complete in the phase files as you go
- Update this README if scope changes
