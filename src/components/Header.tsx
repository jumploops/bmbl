import { cn } from '@/lib/utils/cn';
import { useView } from '@/contexts/ViewContext';
import type { ViewType } from '@/types';

const NAV_ITEMS: { view: ViewType; label: string }[] = [
  { view: 'new', label: 'new' },
  { view: 'old', label: 'old' },
  { view: 'priority', label: 'priority' },
  { view: 'frequent', label: 'frequent' },
  { view: 'hidden', label: 'hidden' },
];

export function Header() {
  const { currentView, setView } = useView();

  return (
    <header className="bg-hn-header text-white">
      <nav className="flex items-center gap-1 px-2 py-0.5 text-[10pt]">
        <span className="font-bold mr-1">bmbl</span>

        {NAV_ITEMS.map((item, index) => (
          <span key={item.view} className="flex items-center">
            {index > 0 && <span className="mx-1">|</span>}
            <button
              onClick={() => setView(item.view)}
              className={cn(
                'hover:underline',
                currentView === item.view && 'font-bold'
              )}
            >
              {item.label}
            </button>
          </span>
        ))}

        <span className="mx-1">|</span>
        <a
          href={chrome.runtime.getURL('options.html')}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          settings
        </a>
      </nav>
    </header>
  );
}
