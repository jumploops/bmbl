import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getSettings } from '@/lib/settings';
import type { ViewType } from '@/types';

interface ViewContextValue {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  isLoading: boolean;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewType>('new');
  const [isLoading, setIsLoading] = useState(true);

  // Load default view from settings
  useEffect(() => {
    getSettings()
      .then((settings) => {
        setCurrentView(settings.defaultView);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const setView = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, []);

  return (
    <ViewContext.Provider value={{ currentView, setView, isLoading }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView(): ViewContextValue {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
}
