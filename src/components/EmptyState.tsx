import { useCapture } from '@/hooks/useCapture';

export function EmptyState() {
  const { capture, isCapturing } = useCapture();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <h2 className="text-lg font-bold mb-2">No saved tabs yet.</h2>

      <p className="text-hn-text-secondary mb-6 text-center max-w-md">
        Click once to save all tabs into a reading backlog.
        Your bookmarks will appear here, sorted and ready to triage.
      </p>

      <button
        onClick={() => capture()}
        disabled={isCapturing}
        className="bg-hn-header text-white px-4 py-2 rounded hover:bg-hn-header-dark disabled:opacity-50"
      >
        {isCapturing ? 'Saving...' : 'Save all open tabs'}
      </button>
    </div>
  );
}
