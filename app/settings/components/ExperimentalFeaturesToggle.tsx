"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { useExperimentalFeatures } from "../hooks/useExperimentalFeatures";

export function ExperimentalFeaturesToggle() {
  const colors = useAppearanceColors();
  const {
    showExperimentalFeatures,
    setShowExperimentalFeatures,
    isUpdating,
  } = useExperimentalFeatures();

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
          Experimental Features
        </h2>
        <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
          Show prototype menus on the home screen
        </p>
      </div>

      <div className="p-4">
        <button
          type="button"
          role="switch"
          aria-checked={showExperimentalFeatures}
          disabled={isUpdating}
          onClick={() => void setShowExperimentalFeatures(!showExperimentalFeatures)}
          className="w-full flex items-center justify-between rounded-xl border-2 px-3 py-3 transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            backgroundColor: showExperimentalFeatures
              ? `${colors.primary.DEFAULT}26`
              : colors.background.DEFAULT,
            borderColor: showExperimentalFeatures
              ? colors.primary.DEFAULT
              : colors.primary.dark,
          }}
          data-testid="settings-show-experimental-features"
        >
          <span
            className="text-sm font-semibold uppercase tracking-wide text-left"
            style={{ color: colors.text.DEFAULT }}
          >
            Show experimental features
          </span>
          <span
            className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors"
            style={{
              backgroundColor: showExperimentalFeatures
                ? colors.primary.DEFAULT
                : colors.background.DEFAULT,
              borderColor: showExperimentalFeatures
                ? colors.primary.light
                : colors.primary.dark,
            }}
            aria-hidden="true"
          >
            <span
              className="h-5 w-5 rounded-full transition-transform"
              style={{
                backgroundColor: colors.text.DEFAULT,
                transform: showExperimentalFeatures
                  ? "translateX(20px)"
                  : "translateX(2px)",
              }}
            />
          </span>
        </button>
      </div>
    </section>
  );
}
