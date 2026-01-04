import type { TabInfo, TabGroupInfo } from '@/types';
import { isCapturableUrl } from '@/lib/utils/url';

/**
 * Query all tabs across all windows
 */
export async function queryAllTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({});
}

/**
 * Query all tab groups
 */
export async function queryAllTabGroups(): Promise<chrome.tabGroups.TabGroup[]> {
  try {
    return await chrome.tabGroups.query({});
  } catch {
    // tabGroups API might not be available in all contexts
    return [];
  }
}

/**
 * Build a map of groupId -> group info
 */
export function buildGroupMap(groups: chrome.tabGroups.TabGroup[]): Map<number, TabGroupInfo> {
  const map = new Map<number, TabGroupInfo>();
  for (const group of groups) {
    map.set(group.id, {
      groupId: group.id,
      title: group.title || null,
      color: group.color || null,
    });
  }
  return map;
}

/**
 * Filter and transform Chrome tabs to our TabInfo format
 * Returns both capturable tabs and skipped count
 */
export function filterAndTransformTabs(
  tabs: chrome.tabs.Tab[],
  _groupMap: Map<number, TabGroupInfo>
): { capturableTabs: TabInfo[]; skippedCount: number } {
  const capturableTabs: TabInfo[] = [];
  let skippedCount = 0;

  for (const tab of tabs) {
    // Skip tabs without URLs
    if (!tab.url || !tab.id) {
      skippedCount++;
      continue;
    }

    // Check if URL is capturable
    if (!isCapturableUrl(tab.url)) {
      skippedCount++;
      continue;
    }

    capturableTabs.push({
      tabId: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title || '',
      favIconUrl: tab.favIconUrl || null,
      pinned: tab.pinned || false,
      groupId: tab.groupId,
    });
  }

  return { capturableTabs, skippedCount };
}

/**
 * Close tabs by ID, excluding pinned tabs
 */
export async function closeTabsExcludingPinned(tabs: TabInfo[]): Promise<void> {
  const tabsToClose = tabs
    .filter(tab => !tab.pinned)
    .map(tab => tab.tabId);

  if (tabsToClose.length > 0) {
    await chrome.tabs.remove(tabsToClose);
  }
}
