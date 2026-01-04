import { useState, useEffect, useCallback } from 'react';
import { listItemsV2, incrementScore, decrementScore, softDelete, restore } from '@/lib/db/items';
import type { Item, ViewType } from '@/types';

const PAGE_SIZE = 30;

interface UseItemsReturn {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  upvote: (itemId: string) => Promise<void>;
  downvote: (itemId: string) => Promise<void>;
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

    listItemsV2({ view, limit: PAGE_SIZE, offset: 0 })
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
      const moreItems = await listItemsV2({ view, limit: PAGE_SIZE, offset });
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
      const loadedItems = await listItemsV2({ view, limit: PAGE_SIZE, offset: 0 });
      setItems(loadedItems);
      setHasMore(loadedItems.length === PAGE_SIZE);
      setOffset(PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  const upvote = useCallback(async (itemId: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, score: item.score + 1 } : item
      )
    );

    try {
      await incrementScore(itemId);
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((item) =>
          item.itemId === itemId ? { ...item, score: item.score - 1 } : item
        )
      );
    }
  }, []);

  const downvote = useCallback(async (itemId: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId
          ? { ...item, score: Math.max(0, item.score - 1) }
          : item
      )
    );

    try {
      await decrementScore(itemId);
    } catch {
      // Revert on error (would need to track original score)
      await refresh();
    }
  }, [refresh]);

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
    upvote,
    downvote,
    hide,
    unhide,
  };
}
