interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded p-4 m-4">
      <p className="text-destructive mb-2">
        Something went wrong loading your backlog.
      </p>
      <p className="text-destructive/80 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-destructive underline hover:no-underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
