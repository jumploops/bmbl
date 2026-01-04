import { Globe, ChevronUp, ChevronDown, Trash2, RotateCcw } from 'lucide-react';
import { formatRelativeTime, formatAbsoluteTime } from '@/lib/utils/time';
import type { Item, ViewType } from '@/types';

interface ItemRowProps {
  item: Item;
  rank: number;
  view: ViewType;
  onUpvote: () => void;
  onDownvote: () => void;
  onHide: () => void;
  onRestore: () => void;
}

export function ItemRow({
  item,
  rank,
  view,
  onUpvote,
  onDownvote,
  onHide,
  onRestore,
}: ItemRowProps) {
  const isHiddenView = view === 'hidden';

  return (
    <div className="flex items-start gap-1 py-1">
      {/* Rank */}
      <span className="text-hn-text-secondary w-8 text-right shrink-0">
        {rank}.
      </span>

      {/* Vote buttons */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <button
          onClick={onUpvote}
          className="text-hn-text-secondary hover:text-hn-text p-0 leading-none"
          title="Upvote"
        >
          <ChevronUp size={12} strokeWidth={3} />
        </button>
        {!isHiddenView && (
          <button
            onClick={onDownvote}
            className="text-hn-text-secondary hover:text-hn-text p-0 leading-none"
            title="Downvote"
          >
            <ChevronDown size={12} strokeWidth={3} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Title + Domain */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Favicon */}
          {item.favIconUrl ? (
            <img
              src={item.favIconUrl}
              alt=""
              className="w-4 h-4 shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Globe size={14} className="text-hn-text-secondary shrink-0" />
          )}

          {/* Title */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-hn-link hover:underline break-words"
            title={item.url}
          >
            {item.title}
          </a>

          {/* Domain */}
          <span className="text-hn-text-secondary text-[8pt]">
            ({item.domain})
          </span>
        </div>

        {/* Line 2: Metadata + Actions */}
        <div className="text-[8pt] text-hn-text-secondary flex items-center gap-2 mt-0.5">
          <span>{item.score} point{item.score !== 1 ? 's' : ''}</span>

          <span title={formatAbsoluteTime(item.lastSavedAt)}>
            saved {formatRelativeTime(item.lastSavedAt)}
          </span>

          {(view === 'frequent' || item.saveCount > 1) && (
            <span>({item.saveCount}x)</span>
          )}

          {/* Actions */}
          {isHiddenView ? (
            <button
              onClick={onRestore}
              className="hover:underline flex items-center gap-0.5"
            >
              <RotateCcw size={10} />
              restore
            </button>
          ) : (
            <button
              onClick={onHide}
              className="hover:underline flex items-center gap-0.5"
            >
              <Trash2 size={10} />
              hide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
