"use client";

interface AddWordModalProps {
  isOpen: boolean;
  newWordInput: string;
  isAdding: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddWordModal({
  isOpen,
  newWordInput,
  isAdding,
  error,
  onInputChange,
  onAdd,
  onClose,
}: AddWordModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4 text-center">Add New Word</h2>

        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-2">English Word</label>
          <input
            type="text"
            value={newWordInput}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Enter an English word..."
            className="w-full p-4 border-2 border-gray-700 bg-gray-900 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            disabled={isAdding}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newWordInput.trim()) {
                onAdd();
              }
            }}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        {isAdding && (
          <div className="mb-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm text-gray-300">Generating Spanish translation and wrong answers...</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onAdd}
            disabled={!newWordInput.trim() || isAdding}
            className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold uppercase disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
          <button
            onClick={onClose}
            disabled={isAdding}
            className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

