# Privacy Policy for Bookmark Backlog (bmbl)

**Last Updated**: January 6, 2026

## Overview

Bookmark Backlog ("bmbl") is a Chrome extension that saves browser tabs locally for reading list management. This privacy policy explains how the extension handles your data.

## Data Collection

**bmbl does NOT collect, transmit, or share any user data.**

All data remains entirely on your device.

## Data Storage

The following data is stored locally in your browser:

| Data Type | Storage Location | Purpose |
|-----------|------------------|---------|
| Saved bookmarks | IndexedDB | Store URLs, titles, favicons, and timestamps |
| Capture history | IndexedDB | Track when and how tabs were saved |
| User settings | chrome.storage.sync | Remember your preferences |

This data:
- Never leaves your device unless you explicitly export it
- Is not accessible to any external servers
- Is not shared with any third parties

## Permissions Explained

bmbl requests the following browser permissions:

| Permission | Why It's Needed |
|------------|-----------------|
| `tabs` | To read URLs and titles when you click to capture |
| `tabGroups` | To preserve tab group names and colors |
| `storage` | To save your extension settings |
| `unlimitedStorage` | To store large bookmark collections |
| `alarms` | To reset the toolbar icon after capture |

Each permission is used only for its stated purpose.

## Third-Party Services

bmbl does **not** use:
- Analytics or tracking services
- External APIs or servers
- Advertising networks
- Cloud storage services

## Data Sharing

We do not share any data with third parties. There is no data to share because everything stays on your device.

## Data Export

You can export your bookmarks at any time:
1. Go to bmbl Settings (right-click extension icon > Options)
2. Click "Export JSON" in the Data section
3. Your bookmarks are saved as a local file you control

## Data Deletion

To delete all bmbl data:
1. Go to bmbl Settings
2. Click "Delete All Data" in the Danger Zone section
3. Confirm deletion

Alternatively, uninstalling the extension removes all stored data.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date above.

## Contact

For questions about this privacy policy or bmbl, please open an issue on our GitHub repository.

---

*bmbl is open source software. You can review our code to verify these privacy practices.*
