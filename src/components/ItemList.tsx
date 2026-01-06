import { useEffect, useRef } from 'react';
import { ItemRow } from './ItemRow';
import { ItemSkeleton } from './ItemSkeleton';
import type { Item, ViewType } from '@/types';

interface ItemListProps {
  items: Item[];
  view: ViewType;
  showFavicons: boolean;
  isLoading: boolean;
  hasMore: boolean;
  startRank?: number;
  onLoadMore: () => void;
  onFavorite: (itemId: string) => void;
  onUnfavorite: (itemId: string) => void;
  onHide: (itemId: string) => void;
  onRestore: (itemId: string) => void;
}

export function ItemList({
  items,
  view,
  showFavicons,
  isLoading,
  hasMore,
  startRank = 1,
  onLoadMore,
  onFavorite,
  onUnfavorite,
  onHide,
  onRestore,
}: ItemListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div className="px-2">
      {items.map((item, index) => (
        <ItemRow
          key={item.itemId}
          item={item}
          rank={startRank + index}
          view={view}
          showFavicons={showFavicons}
          onFavorite={() => onFavorite(item.itemId)}
          onUnfavorite={() => onUnfavorite(item.itemId)}
          onHide={() => onHide(item.itemId)}
          onRestore={() => onRestore(item.itemId)}
        />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {/* Loading indicator */}
      {isLoading && items.length > 0 && (
        <div className="py-2">
          <ItemSkeleton count={3} />
        </div>
      )}
    </div>
  );
}
