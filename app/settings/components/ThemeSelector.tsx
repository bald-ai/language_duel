"use client";

import { colors, themeOptions } from "@/lib/theme";
import { useTheme } from "@/app/components/ThemeProvider";

export function ThemeSelector() {
  const { themeName, setTheme } = useTheme();

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
          Theme
        </h2>
        <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
          Choose your palette
        </p>
      </div>

      <div className="p-4 grid gap-2">
        {themeOptions.map((option) => {
          const isActive = option.name === themeName;

          return (
            <button
              key={option.name}
              onClick={() => setTheme(option.name)}
              className="w-full flex items-center justify-between rounded-xl border-2 px-3 py-3 transition hover:brightness-110"
              style={{
                backgroundColor: isActive
                  ? `${colors.primary.DEFAULT}26`
                  : colors.background.DEFAULT,
                borderColor: isActive ? colors.primary.DEFAULT : colors.primary.dark,
              }}
              aria-pressed={isActive}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: option.preview.primary }}
                  />
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: option.preview.secondary }}
                  />
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: option.preview.cta }}
                  />
                </div>
                <span
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{ color: colors.text.DEFAULT }}
                >
                  {option.label}
                </span>
              </div>
              {isActive && (
                <span
                  className="text-[11px] uppercase tracking-widest"
                  style={{ color: colors.secondary.light }}
                >
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
