import { ViewProvider, useView } from '@/contexts/ViewContext';
import { Header } from '@/components/Header';
import { ItemList } from '@/components/ItemList';
import { ItemSkeleton } from '@/components/ItemSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useItems } from '@/hooks/useItems';
import { useDarkMode } from '@/hooks/useDarkMode';

function NewTabContent() {
  const { currentView } = useView();
  const {
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
  } = useItems(currentView);

  // Error state
  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  // Loading state (initial load)
  if (isLoading && items.length === 0) {
    return (
      <main className="py-2">
        <ItemSkeleton count={10} />
      </main>
    );
  }

  // Empty state
  if (!isLoading && items.length === 0) {
    return <EmptyState />;
  }

  // Loaded state
  return (
    <main className="py-2">
      <ItemList
        items={items}
        view={currentView}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onUpvote={upvote}
        onDownvote={downvote}
        onHide={hide}
        onRestore={unhide}
      />
    </main>
  );
}

export default function App() {
  useDarkMode(); // Apply dark mode class to html

  return (
    <ViewProvider>
      <div className="min-h-screen bg-hn-bg text-hn-text dark:bg-hn-bg dark:text-hn-text font-[family-name:var(--font-hn)] text-[10pt]">
        <Header />
        <NewTabContent />
      </div>
    </ViewProvider>
  );
}
