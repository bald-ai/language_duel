"use client";

import { ReactNode } from "react";

interface MenuButtonProps {
  onClick: () => void;
  children: ReactNode;
  badge?: number;
}

export function MenuButton({ onClick, children, badge }: MenuButtonProps) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="w-full bg-gradient-to-b from-amber-600 to-amber-800 border-t-2 border-t-amber-400/60 border-b-4 border-b-amber-900 border-x-2 border-x-amber-700 rounded-lg py-3 text-lg font-bold text-amber-100 uppercase tracking-wide hover:from-amber-500 hover:to-amber-700 hover:translate-y-0.5 hover:border-b-2 active:translate-y-1 active:border-b-0 transition-all shadow-lg"
        style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
      >
        {children}
      </button>
      {badge !== undefined && badge > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold leading-none">
          {badge}
        </div>
      )}
    </div>
  );
}

