interface ItemSkeletonProps {
  count?: number;
}

export function ItemSkeleton({ count = 5 }: ItemSkeletonProps) {
  return (
    <div className="px-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-1 py-1 animate-pulse">
          {/* Rank */}
          <div className="w-5 h-4 bg-muted rounded" />

          {/* Vote placeholder */}
          <div className="w-3 h-6 bg-muted rounded" />

          {/* Content */}
          <div className="flex-1">
            <div className="h-4 bg-muted rounded w-3/4 mb-1" />
            <div className="h-3 bg-muted/50 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
