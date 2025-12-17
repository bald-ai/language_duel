"use client";

interface ExitButtonProps {
  onExit: () => Promise<void>;
}

export function ExitButton({ onExit }: ExitButtonProps) {
  return (
    <button
      onClick={onExit}
      className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors"
    >
      Exit
    </button>
  );
}
