"use client";

import Image from "next/image";
import { colors } from "@/lib/theme";

const BACKGROUND_OPTIONS = [
  { filename: "background.jpg", label: "Castle Lights" },
  { filename: "background_2.jpg", label: "Mystic Forest" },
] as const;

type BackgroundSelectorProps = {
  selectedBackground: string | null;
  onSelect: (background: string) => void;
  isUpdating?: boolean;
};

export function BackgroundSelector({
  selectedBackground,
  onSelect,
  isUpdating = false,
}: BackgroundSelectorProps) {
  // Default to first background if none selected
  const activeBackground = selectedBackground || BACKGROUND_OPTIONS[0].filename;

  return (
    <section
      className="rounded-2xl border-2 overflow-hidden"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <div
        className="px-4 py-3 border-b-2"
        style={{ borderColor: colors.primary.dark }}
      >
        <h2
          className="text-lg font-bold uppercase tracking-wide"
          style={{ color: colors.text.DEFAULT }}
        >
          Background
        </h2>
        <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
          Choose your backdrop
        </p>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {BACKGROUND_OPTIONS.map((option) => {
          const isActive = option.filename === activeBackground;

          return (
            <button
              key={option.filename}
              onClick={() => onSelect(option.filename)}
              disabled={isUpdating}
              className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                borderColor: isActive ? colors.cta.DEFAULT : colors.primary.dark,
                boxShadow: isActive ? `0 0 12px ${colors.cta.glow}` : undefined,
              }}
              aria-pressed={isActive}
              data-testid={`settings-background-${option.filename.replace(/\\W+/g, "-")}`}
            >
              <Image
                src={`/${option.filename}`}
                alt={option.label}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 45vw, 200px"
              />

              {/* Dark overlay for better text visibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {/* Label */}
              <span
                className="absolute bottom-2 left-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: colors.text.DEFAULT }}
              >
                {option.label}
              </span>

              {/* Active checkmark */}
              {isActive && (
                <div
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.cta.DEFAULT }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke={colors.text.DEFAULT}
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
