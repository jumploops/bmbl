import type { TabInfo, TabGroupInfo, AggregatedTab } from '@/types';
import { isCapturableUrl, normalizeUrl } from '@/lib/utils/url';

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

/**
 * Aggregate tabs by normalized URL
 *
 * Metadata resolution strategy:
 * - Use first tab's data as default
 * - If title is empty, use first tab that has a title
 * - If favicon is null, use first tab that has a favicon
 * - Group info from first tab that's in a group
 */
export function aggregateTabsByUrl(
  capturableTabs: TabInfo[],
  groupMap: Map<number, TabGroupInfo>
): AggregatedTab[] {
  const aggregatedMap = new Map<string, AggregatedTab>();

  for (const tab of capturableTabs) {
    const normalized = normalizeUrl(tab.url);

    if (!aggregatedMap.has(normalized)) {
      // First tab with this URL - initialize aggregation
      const groupInfo = tab.groupId !== -1 ? groupMap.get(tab.groupId) : undefined;

      aggregatedMap.set(normalized, {
        normalizedUrl: normalized,
        url: tab.url,
        title: tab.title || '',
        favIconUrl: tab.favIconUrl,
        tabs: [tab],
        windowIds: [tab.windowId],
        tabIds: [tab.tabId],
        pinnedAny: tab.pinned,
        groupId: groupInfo?.groupId ?? null,
        groupTitle: groupInfo?.title ?? null,
        groupColor: groupInfo?.color ?? null,
      });
    } else {
      // Additional tab with same URL - merge data
      const existing = aggregatedMap.get(normalized)!;
      existing.tabs.push(tab);
      existing.windowIds.push(tab.windowId);
      existing.tabIds.push(tab.tabId);

      // Update pinnedAny if this tab is pinned
      if (tab.pinned) {
        existing.pinnedAny = true;
      }

      // Fill in missing title from this tab
      if (!existing.title && tab.title) {
        existing.title = tab.title;
      }

      // Fill in missing favicon from this tab
      if (!existing.favIconUrl && tab.favIconUrl) {
        existing.favIconUrl = tab.favIconUrl;
      }

      // Fill in missing group info from this tab
      if (existing.groupId === null && tab.groupId !== -1) {
        const groupInfo = groupMap.get(tab.groupId);
        if (groupInfo) {
          existing.groupId = groupInfo.groupId;
          existing.groupTitle = groupInfo.title;
          existing.groupColor = groupInfo.color;
        }
      }
    }
  }

  return Array.from(aggregatedMap.values());
}
