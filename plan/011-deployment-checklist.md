# Chrome Web Store Deployment Checklist — bmbl v0.0.1

**Date Created**: 2026-01-06
**Target**: Chrome Web Store (Public Release)
**Extension**: Bookmark Backlog (bmbl) v0.0.1

---

## Pre-Deployment Summary

| Category | Status |
|----------|--------|
| Tests | 31/31 passing |
| TypeScript | No errors |
| Build | Successful (513.68 KB uncompressed, 177.29 KB zipped) |
| Icons | All sizes present (16, 32, 48, 128) |
| Manifest | Valid MV3 format |

---

## 1. Code Verification

### 1.1 Quality Gates

- [ ] **Run test suite**: `pnpm test`
  - Expected: All 31 tests pass
  - Current: Passing

- [ ] **Run type checking**: `pnpm typecheck`
  - Expected: No errors
  - Current: Passing

- [ ] **Production build**: `pnpm build`
  - Expected: Successful build
  - Current: Passing (513.68 KB)

- [ ] **Create distribution ZIP**: `pnpm zip`
  - Expected: Creates `.output/bmbl-0.0.1-chrome.zip`
  - Current: Creates 177.29 KB zip

### 1.2 Manual Testing Checklist

Before submission, manually test all core functionality:

**Capture Flow**
- [ ] Click toolbar icon to capture tabs
- [ ] Verify icon states: default → loading → success (5s) → default
- [ ] Verify capture works with 10+ tabs open
- [ ] Verify capture skips chrome://, file://, chrome-extension:// URLs
- [ ] Verify capture across multiple windows

**New Tab Page**
- [ ] Opens and loads quickly
- [ ] Shows captured items correctly
- [ ] Pagination/infinite scroll works
- [ ] All view tabs work: new, old, favorites, frequent, hidden

**Item Actions**
- [ ] Favorite (upvote arrow) works
- [ ] Unfavorite works
- [ ] Hide works (item moves to hidden view)
- [ ] Restore works (item returns from hidden view)
- [ ] Click item opens in new tab

**Settings Page**
- [ ] Auto-close toggle saves correctly
- [ ] Auto-close excludes pinned tabs when enabled
- [ ] Default view saves correctly
- [ ] Dark mode (system/light/dark) works
- [ ] Show favicons toggle works

**Import/Export**
- [ ] Export downloads JSON file
- [ ] Export with "include hidden" works
- [ ] Import validates file correctly
- [ ] Import with skip/merge strategies works
- [ ] Delete All Data works with confirmation

**Edge Cases**
- [ ] Empty state shows correctly (no items)
- [ ] Error recovery after IndexedDB failure
- [ ] Duplicate URLs deduplicated correctly
- [ ] Very long titles display properly
- [ ] Special characters in titles/URLs handled

---

## 2. Chrome Web Store Developer Account

### 2.1 Account Setup (One-Time)

- [ ] **Create Google account** (or use existing)
- [ ] **Register as Chrome Web Store developer**
  - URL: https://chrome.google.com/webstore/devconsole
  - One-time fee: $5 USD

- [ ] **Verify identity**
  - Required for publishing
  - May require additional verification for certain permission types

### 2.2 Account Information

- [ ] Developer name configured
- [ ] Support email configured
- [ ] Payment setup (if using paid features)

---

## 3. Store Listing Assets

### 3.1 Required Assets

**Icons** (Already in project)
- [x] 128x128 PNG icon (in `public/icon/128.png`)

**Screenshots** (NEED TO CREATE)
- [ ] At least 1 screenshot required
- [ ] Recommended: 3-5 screenshots
- [ ] Size: 1280x800 or 640x400 pixels
- [ ] Format: PNG or JPEG
- [ ] No alpha/transparency for screenshots

**Suggested screenshots to create:**
1. [ ] New Tab page with items list (light mode)
2. [ ] New Tab page with items list (dark mode)
3. [ ] Settings page overview
4. [ ] Capture in action (icon states)
5. [ ] Empty state with call-to-action

**Promotional Images** (Optional but Recommended)
- [ ] Small promo tile: 440x280 pixels (for featured placement)
- [ ] Marquee promo tile: 1400x560 pixels (for hero banner)

### 3.2 Text Content

**Store Listing Text** (to prepare)

```
Name: Bookmark Backlog
Short Name: bmbl
```

**Summary** (132 characters max):
```
Save all tabs with one click. Triage your reading backlog with a Hacker News-style interface.
```

**Description** (16,000 characters max):
```
# Bookmark Backlog (bmbl)

Save all your open tabs across all windows with a single click. No more tab hoarding anxiety—just click once to save everything, then review and prioritize at your own pace.

## Features

• ONE-CLICK CAPTURE
Click the bmbl icon to instantly save all open tabs. The extension captures URLs, titles, and favicons from every window in your browser.

• HACKER NEWS-STYLE INTERFACE
Your new tab page becomes a clean, information-dense reading list. No clutter, no distractions—just your saved links organized the way you want.

• SMART DEDUPLICATION
Saved the same page multiple times? bmbl tracks it, not duplicates it. See how often you've saved each URL.

• MULTIPLE VIEWS
- New: Most recently saved items first
- Old: Oldest items first
- Favorites: Your starred must-reads
- Frequent: Most-saved URLs
- Hidden: Items you've archived

• FAVORITES
Star important items to add them to your favorites list. Never lose track of must-read content.

• SOFT DELETE
Hide items you don't need. They're not gone—restore them anytime from the hidden view.

• DARK MODE
Choose light mode, dark mode, or follow your system preference.

• IMPORT & EXPORT
Back up your bookmarks as JSON. Import from bmbl exports or browser bookmark files.

• PRIVACY FIRST
All data stays in your browser. No accounts, no cloud sync, no tracking. Your browsing history is yours alone.

## Permissions Explained

• tabs: Read URLs and titles to capture your tabs
• tabGroups: Read tab group names and colors
• storage: Save your settings
• unlimitedStorage: Store your bookmark backlog locally
• alarms: Reset the toolbar icon after capture

## Tips

• Click the bmbl icon anytime to capture all open tabs
• Use the "hide" action to archive items you've finished reading
• Enable "Auto-close after save" in settings to close captured tabs automatically (pinned tabs are never closed)
• Export your bookmarks regularly as a backup
```

**Category**: Productivity

**Language**: English

---

## 4. Privacy Requirements

### 4.1 Privacy Policy

Chrome Web Store requires a privacy policy URL. The `PRIVACY.md` file has been created in the repository root.

**Hosting Options (choose one):**

**Option A: GitHub Raw URL** (Simplest)
```
https://raw.githubusercontent.com/[username]/bmbl/main/PRIVACY.md
```
- [ ] Push PRIVACY.md to GitHub
- [ ] Use raw.githubusercontent.com URL
- Note: Renders as plain Markdown text

**Option B: GitHub Pages** (Better formatting)
```
https://[username].github.io/bmbl/PRIVACY
```
- [ ] Enable GitHub Pages in repository settings
- [ ] Set source to main branch
- [ ] URL will render Markdown nicely

**Option C: GitHub Repository Link**
```
https://github.com/[username]/bmbl/blob/main/PRIVACY.md
```
- [ ] Push PRIVACY.md to GitHub
- [ ] Use blob URL (renders with GitHub styling)

**Option D: External hosting**
- [ ] Host on personal domain
- [ ] Ensure HTTPS is enabled

**Privacy Policy Content** (draft):

```markdown
# Privacy Policy for Bookmark Backlog (bmbl)

Last updated: 2026-01-06

## Data Collection

Bookmark Backlog does NOT collect, transmit, or share any user data.

## Data Storage

All data is stored locally in your browser using IndexedDB and chrome.storage.sync:
- Saved bookmarks (URLs, titles, favicons, timestamps)
- Capture history
- User preferences (settings)

This data never leaves your device unless you explicitly export it.

## Permissions

We request the following permissions for these specific purposes:
- **tabs**: To read URLs and titles of your open tabs when you click to capture
- **tabGroups**: To preserve tab group information when capturing
- **storage**: To save your extension settings
- **unlimitedStorage**: To store your bookmark backlog without size limits
- **alarms**: To reset the toolbar icon after a capture completes

## Third-Party Services

Bookmark Backlog does not use any third-party analytics, tracking, or data collection services.

## Data Sharing

We do not share any data with third parties. Period.

## Contact

For questions about this privacy policy, please [contact method].
```

### 4.2 Privacy Practices Declaration

When submitting, you'll declare:
- [ ] **Single Purpose**: Describe what the extension does
- [ ] **Permission Justification**: Explain why each permission is needed
- [ ] **Data Usage Disclosure**: Confirm no data collection
- [ ] **Remote Code**: Confirm no remote code execution

---

## 5. Manifest & Package Verification

### 5.1 Manifest Requirements

Current manifest (`wxt.config.ts` → `.output/chrome-mv3/manifest.json`):

```json
{
  "manifest_version": 3,
  "name": "Bookmark Backlog",
  "short_name": "bmbl",
  "description": "Save all tabs with one click. Triage your reading backlog.",
  "version": "0.0.1",
  "permissions": ["tabs", "tabGroups", "storage", "unlimitedStorage", "alarms"],
  "action": { "default_title": "Save all tabs" },
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "background": { "service_worker": "background.js" },
  "options_ui": { "page": "options.html" },
  "icons": {
    "16": "icon/16.png",
    "32": "icon/32.png",
    "48": "icon/48.png",
    "128": "icon/128.png"
  }
}
```

**Checklist:**
- [x] `manifest_version`: 3 (required for new submissions)
- [x] `name`: Under 45 characters
- [x] `short_name`: Under 12 characters
- [x] `description`: Under 132 characters
- [x] `version`: Semantic format (0.0.1)
- [x] `icons`: All required sizes (16, 32, 48, 128)
- [x] `action`: Has default_title
- [x] No deprecated manifest fields

### 5.2 Package Size

- [x] Uncompressed: 513.68 KB (well under limits)
- [x] Compressed ZIP: 177.29 KB (well under 10MB limit)

---

## 6. Submission Process

### 6.1 Prepare Submission

1. [ ] Log in to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

2. [ ] Click "New Item"

3. [ ] Upload ZIP file: `.output/bmbl-0.0.1-chrome.zip`

### 6.2 Store Listing Tab

4. [ ] Enter extension description (from Section 3.2)
5. [ ] Select category: **Productivity**
6. [ ] Select language: **English**
7. [ ] Upload screenshots (minimum 1, recommended 3-5)
8. [ ] Upload promotional images (optional)

### 6.3 Privacy Tab

9. [ ] Enter privacy policy URL (see Section 4)

10. [ ] **Single Purpose Description** (copy exactly):
```
Bookmark Backlog saves all open browser tabs with one click and displays them in a Hacker News-style new tab page for reading list triage. Users can favorite, hide, and organize saved links. All data is stored locally in the browser and never transmitted externally.
```

11. [ ] **Permission Justifications** (copy each exactly):

**tabs justification:**
```
Required to capture browser tabs when the user clicks the toolbar icon. The extension queries all open tabs across all windows to read their URLs, titles, and favicon URLs. This data is saved locally to IndexedDB for the user's bookmark backlog. When the "auto-close after save" setting is enabled, this permission is also used to close the captured tabs (excluding pinned tabs). The permission is only exercised when the user explicitly triggers a capture.
```

**tabGroups justification:**
```
Required to read Chrome tab group metadata (group name and color) when capturing tabs. This information is stored alongside the bookmark data so users can see which tab group a saved link originated from. The tab group data stays local and is never transmitted externally.
```

**storage justification:**
```
Required to persist user preferences using chrome.storage.sync. Settings stored include: auto-close behavior toggle, default view selection (new/old/favorites/frequent), theme preference (system/light/dark), and favicon display toggle. Using sync storage allows settings to persist across browser sessions.
```

**unlimitedStorage justification:**
```
Required to allow the local IndexedDB database to exceed the default 5MB quota. Users accumulate bookmarks over time and may save thousands of URLs. Without this permission, users would hit storage limits and lose the ability to save new bookmarks. All data remains local and is never transmitted.
```

**alarms justification:**
```
Required to reset the toolbar icon back to its default state after a capture completes. In Manifest V3, service workers can be terminated by Chrome at any time, which would cause setTimeout to fail. The alarm acts as a safety net to ensure the icon doesn't remain stuck in the "success" state if the service worker is terminated before the timeout fires.
```

12. [ ] **Remote Code**: Select "No, I am not using Remote code"
    - All JavaScript is bundled in the extension package
    - No external script references
    - No eval() or dynamic code execution

13. [ ] **Data Usage Checkboxes**:

| Data Type | Check? | Rationale |
|-----------|--------|-----------|
| Personally identifiable information | ❌ No | We don't collect names, emails, addresses |
| Health information | ❌ No | Not applicable |
| Financial and payment information | ❌ No | Not applicable |
| Authentication information | ❌ No | No passwords or credentials stored |
| Personal communications | ❌ No | We don't access emails, messages |
| Location | ❌ No | No GPS, IP tracking, or location data |
| **Web history** | ✅ **Yes** | We store URLs, titles, and timestamps of tabs users explicitly save |
| User activity | ❌ No | No click tracking, mouse position, keystroke logging |
| Website content | ❌ No | We store URLs/titles only, not page content |

**Important note on "Web history"**: While we DO check this box because we store URLs and page titles, our privacy policy makes clear that:
- Data is ONLY saved when user explicitly clicks to capture
- ALL data stays LOCAL in IndexedDB
- Data is NEVER transmitted externally
- Users can export or delete their data anytime

14. [ ] **Certifications** (check all three):
    - [x] "I do not sell or transfer user data to third parties, outside of the approved use cases"
    - [x] "I do not use or transfer user data for purposes that are unrelated to my item's single purpose"
    - [x] "I do not use or transfer user data to determine creditworthiness or for lending purposes"

All three certifications are TRUE because:
- All data stays local in IndexedDB
- No external servers or APIs are contacted
- No data is ever transmitted anywhere

15. [ ] **Privacy Policy URL**: Enter the hosted URL (see Section 4)

### 6.4 Distribution Tab

16. [ ] Visibility: **Public** (or Unlisted for initial testing)
17. [ ] Countries: **All regions** (or specific selection)

### 6.5 Submit for Review

18. [ ] Review all information
19. [ ] Click "Submit for Review"
20. [ ] Note submission ID for tracking

---

## 7. Post-Submission

### 7.1 Review Process

- **Typical review time**: 1-3 business days (can vary)
- **Status tracking**: Check Developer Dashboard

### 7.2 Common Rejection Reasons (and how we address them)

| Reason | Our Status |
|--------|------------|
| Missing privacy policy | Need to create and host |
| Insufficient permission justification | Prepared in Section 6.3 |
| Functionality not working | Manual testing checklist in Section 1.2 |
| Misleading description | Description matches actual functionality |
| Store listing policy violation | Reviewed guidelines |

### 7.3 If Rejected

1. Read rejection reason carefully
2. Address specific issues cited
3. Update code/listing as needed
4. Resubmit with explanation of changes

### 7.4 After Approval

1. [ ] Verify extension appears in Chrome Web Store
2. [ ] Test installation from store
3. [ ] Monitor reviews and ratings
4. [ ] Set up alerts for user feedback

---

## 8. Pre-Flight Checklist Summary

### Must Have (Blocking)
- [ ] All tests passing
- [ ] Build successful
- [ ] Manual testing complete
- [ ] Chrome Web Store developer account
- [ ] Screenshots created (minimum 1)
- [ ] Privacy policy URL

### Should Have
- [ ] 3-5 screenshots
- [ ] Store description finalized
- [ ] Small promo tile (440x280)

### Nice to Have
- [ ] Marquee promo tile (1400x560)
- [ ] Demo video

---

## 9. Files to Create

Before submission, create these files:

### 9.1 PRIVACY.md (Required)
Location: Repository root or hosted page
Content: See Section 4.1

### 9.2 Screenshots (Required)
Location: `assets/store/` or similar
- [ ] screenshot-1-newtab-light.png (1280x800)
- [ ] screenshot-2-newtab-dark.png (1280x800)
- [ ] screenshot-3-settings.png (1280x800)

### 9.3 Promotional Images (Optional)
- [ ] promo-small.png (440x280)
- [ ] promo-marquee.png (1400x560)

---

## 10. Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.0.1 | 2026-01-06 | Initial release |

---

## Quick Commands Reference

```bash
# Run all checks before submission
pnpm test && pnpm typecheck && pnpm build

# Create distribution ZIP
pnpm zip

# Output location
.output/bmbl-0.0.1-chrome.zip
```
