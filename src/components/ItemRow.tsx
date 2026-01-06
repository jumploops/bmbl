import { Globe } from 'lucide-react';
import { formatRelativeTime, formatAbsoluteTime } from '@/lib/utils/time';
import { isValidFaviconUrl } from '@/lib/utils/url';
import type { Item, ViewType } from '@/types';
import { NOT_FAVORITED } from '@/types';

function VoteArrow({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-[10px] h-[10px] p-0 border-0 bg-transparent cursor-pointer"
      title="Add to favorites"
    >
      <svg
        viewBox="0 0 10 10"
        className="w-[10px] h-[10px] text-hn-text-secondary hover:text-hn-text"
      >
        <polygon points="5,0 10,10 0,10" fill="currentColor" />
      </svg>
    </button>
  );
}

interface ItemRowProps {
  item: Item;
  rank: number;
  view: ViewType;
  showFavicons: boolean;
  onFavorite: () => void;
  onUnfavorite: () => void;
  onHide: () => void;
  onRestore: () => void;
}

export function ItemRow({
  item,
  rank,
  view,
  showFavicons,
  onFavorite,
  onUnfavorite,
  onHide,
  onRestore,
}: ItemRowProps) {
  const isHiddenView = view === 'hidden';

  return (
    <div className="flex items-start gap-1 py-1">
      {/* Rank */}
      <span className="text-hn-text-secondary w-5 text-right shrink-0">
        {rank}.
      </span>

      {/* Vote arrow - visible only when not favorited, space preserved */}
      <div className="w-[14px] shrink-0 flex justify-center pt-1">
        {item.favoritedAt === NOT_FAVORITED && !isHiddenView && (
          <VoteArrow onClick={onFavorite} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Title + Domain */}
        <div className="flex items-start gap-1">
          {/* Favicon */}
          {showFavicons && (
            isValidFaviconUrl(item.favIconUrl) ? (
              <img
                src={item.favIconUrl!}
                alt=""
                className="w-4 h-4 shrink-0 mt-0.5"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <Globe size={14} className="text-hn-text-secondary shrink-0 mt-0.5" />
            )
          )}

          {/* Title + Domain wrapper */}
          <div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-hn-link hover:underline break-words"
              title={item.url}
            >
              {item.title}
            </a>
            {' '}
            <span className="text-hn-text-secondary text-[8pt]">
              ({item.domain})
            </span>
          </div>
        </div>

        {/* Line 2: Metadata + Actions */}
        <div className="text-[8pt] text-hn-text-secondary flex items-center gap-1">
          <span>{item.saveCount} save{item.saveCount !== 1 ? 's' : ''}</span>

          <span title={formatAbsoluteTime(item.lastSavedAt)}>
            {formatRelativeTime(item.lastSavedAt)}
          </span>

          {/* Actions */}
          <span>|</span>
          {isHiddenView ? (
            <button
              onClick={onRestore}
              className="hover:underline cursor-pointer"
            >
              restore
            </button>
          ) : (
            <>
              <button
                onClick={onHide}
                className="hover:underline cursor-pointer"
              >
                hide
              </button>
              {item.favoritedAt !== NOT_FAVORITED && (
                <>
                  <span>|</span>
                  <button onClick={onUnfavorite} className="hover:underline cursor-pointer">
                    unfavorite
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
