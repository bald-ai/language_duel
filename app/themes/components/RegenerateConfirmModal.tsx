"use client";

interface RegenerateConfirmModalProps {
  isOpen: boolean;
  pendingWord: string;
  isRegenerating: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function RegenerateConfirmModal({
  isOpen,
  pendingWord,
  isRegenerating,
  onConfirm,
  onSkip,
  onCancel,
}: RegenerateConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4 text-center">Regenerate Answers?</h2>

        <div className="mb-4 p-3 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl">
          <div className="text-xs text-blue-300 mb-1">New Word</div>
          <div className="text-lg font-bold text-blue-200">{pendingWord}</div>
        </div>

        <p className="text-gray-300 text-sm mb-6 text-center">
          You changed the word. Would you like to regenerate the correct answer and wrong answers to match the new word?
        </p>

        {isRegenerating && (
          <div className="mb-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm text-gray-300">Generating new answers...</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isRegenerating}
            className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold uppercase hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isRegenerating ? "..." : "Yes"}
          </button>
          <button
            onClick={onSkip}
            disabled={isRegenerating}
            className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            No
          </button>
          <button
            onClick={onCancel}
            disabled={isRegenerating}
            className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

