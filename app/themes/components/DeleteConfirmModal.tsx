"use client";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemName: string;
  itemType: "theme" | "word";
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  itemName,
  itemType,
  isDeleting = false,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4 text-center">
          Delete {itemType === "theme" ? "Theme" : "Word"}?
        </h2>

        <div className="mb-4 p-3 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
          <div className="text-xs text-red-300 mb-1">
            {itemType === "theme" ? "Theme" : "Word"}
          </div>
          <div className="text-lg font-bold text-red-200">{itemName}</div>
        </div>

        <p className="text-gray-300 text-sm mb-6 text-center">
          {itemType === "theme"
            ? "This will permanently delete this theme and all its words."
            : "This will remove the word from this theme."}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 bg-red-600 text-white rounded-xl py-3 font-bold uppercase hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

