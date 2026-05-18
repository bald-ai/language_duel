"use client";

import { useEffect, useRef } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { CONFIDENCE_COLORS, type ConfidenceLevel } from "./ConfidenceSlider";

interface SetAllDropdownProps {
  onSelect: (level: ConfidenceLevel) => void;
  onClose: () => void;
}

const levels = [0, 1, 2, 3] as const;

export function SetAllDropdown({ onSelect, onClose }: SetAllDropdownProps) {
  const colors = useAppearanceColors();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className="absolute left-1/2 top-full z-50 mt-2 flex -translate-x-1/2 flex-col gap-2 rounded-xl border-2 p-2 shadow-xl"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
      data-testid="solo-learn-set-all-dropdown"
    >
      {levels.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onSelect(level)}
          className="h-10 w-10 rounded-lg border-2 text-sm font-bold transition hover:brightness-110 active:scale-95"
          style={{
            backgroundColor: CONFIDENCE_COLORS[level],
            borderColor: colors.background.DEFAULT,
            color: colors.text.DEFAULT,
            textShadow: "0 1px 3px rgba(0,0,0,0.35)",
          }}
          data-testid={`solo-learn-set-all-level-${level}`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}
