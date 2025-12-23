"use client";

import { colors } from "@/lib/theme";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearching: boolean;
}

export function SearchBar({ searchTerm, onSearchChange, isSearching }: SearchBarProps) {
  return (
    <div className="relative">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Email or Name#1234"
        className="w-full px-4 py-3 pl-10 rounded-xl border-2 focus:outline-none transition-colors"
        style={{
          backgroundColor: colors.primary.dark,
          borderColor: colors.primary.DEFAULT,
          color: colors.text.DEFAULT,
        }}
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
        fill="none"
        stroke={colors.text.muted}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div 
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: colors.cta.DEFAULT, borderTopColor: "transparent" }}
          />
        </div>
      )}
    </div>
  );
}
