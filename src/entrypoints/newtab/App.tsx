import { ViewProvider, useView } from '@/contexts/ViewContext';
import { Header } from '@/components/Header';
import { ItemList } from '@/components/ItemList';
import { ItemSkeleton } from '@/components/ItemSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { useItems } from '@/hooks/useItems';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useCaptureListener } from '@/hooks/useCaptureListener';
import { useSettings } from '@/hooks/useSettings';

function NewTabContent() {
  const { currentView, isLoading: viewLoading } = useView();
  const {
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
  } = useItems(currentView);

  // Listen for capture completion and refresh the list
  useCaptureListener(refresh);

  // Wait for view settings to load
  if (viewLoading) {
    return (
      <main className="py-2">
        <ItemSkeleton count={10} />
      </main>
    );
  }

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
        onFavorite={favorite}
        onUnfavorite={unfavorite}
        onHide={hide}
        onRestore={unhide}
      />
    </main>
  );
}

export default function App() {
  const { settings } = useSettings();
  useDarkMode(settings.darkMode); // Apply dark mode class to html

  return (
    <ViewProvider>
      <div className="min-h-screen bg-hn-bg text-hn-text dark:bg-hn-bg dark:text-hn-text font-[family-name:var(--font-hn)] text-[10pt]">
        <div className="w-full lg:w-[85%] mx-auto bg-hn-content-bg pt-2">
          <Header />
          <NewTabContent />
        </div>
      </div>
    </ViewProvider>
  );
}
