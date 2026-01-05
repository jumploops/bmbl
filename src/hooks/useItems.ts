import { useState, useEffect, useCallback } from 'react';
import { listItems, setFavorite, unsetFavorite, softDelete, restore } from '@/lib/db/items';
import type { Item, ViewType } from '@/types';
import { NOT_FAVORITED } from '@/types';

const PAGE_SIZE = 30;

interface UseItemsReturn {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  favorite: (itemId: string) => Promise<void>;
  unfavorite: (itemId: string) => Promise<void>;
  hide: (itemId: string) => Promise<void>;
  unhide: (itemId: string) => Promise<void>;
}

export function useItems(view: ViewType): UseItemsReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Initial load
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setIsLoading(true);
    setError(null);

    listItems({ view, limit: PAGE_SIZE, offset: 0 })
      .then((loadedItems) => {
        setItems(loadedItems);
        setHasMore(loadedItems.length === PAGE_SIZE);
        setOffset(PAGE_SIZE);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load items');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [view]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const moreItems = await listItems({ view, limit: PAGE_SIZE, offset });
      setItems((prev) => [...prev, ...moreItems]);
      setHasMore(moreItems.length === PAGE_SIZE);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more items');
    } finally {
      setIsLoading(false);
    }
  }, [view, offset, isLoading, hasMore]);

  const refresh = useCallback(async () => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setIsLoading(true);
    setError(null);

    try {
      const loadedItems = await listItems({ view, limit: PAGE_SIZE, offset: 0 });
      setItems(loadedItems);
      setHasMore(loadedItems.length === PAGE_SIZE);
      setOffset(PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  const favorite = useCallback(async (itemId: string) => {
    const now = Date.now();
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, favoritedAt: now } : item
      )
    );

    try {
      await setFavorite(itemId);
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((item) =>
          item.itemId === itemId ? { ...item, favoritedAt: NOT_FAVORITED } : item
        )
      );
    }
  }, []);

  const unfavorite = useCallback(async (itemId: string) => {
    // Store original value for revert
    const originalFavoritedAt = items.find(i => i.itemId === itemId)?.favoritedAt;

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, favoritedAt: NOT_FAVORITED } : item
      )
    );

    try {
      await unsetFavorite(itemId);
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((item) =>
          item.itemId === itemId ? { ...item, favoritedAt: originalFavoritedAt ?? NOT_FAVORITED } : item
        )
      );
    }
  }, [items]);

  const hide = useCallback(async (itemId: string) => {
    // Optimistic update - remove from list
    setItems((prev) => prev.filter((item) => item.itemId !== itemId));

    try {
      await softDelete(itemId);
    } catch {
      await refresh();
    }
  }, [refresh]);

  const unhide = useCallback(async (itemId: string) => {
    // Optimistic update - remove from hidden list
    setItems((prev) => prev.filter((item) => item.itemId !== itemId));

    try {
      await restore(itemId);
    } catch {
      await refresh();
    }
  }, [refresh]);

  return {
    items,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    favorite,
    unfavorite,
    hide,
    unhide,
  };
}
