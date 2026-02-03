"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";

interface GoalTheme {
  themeId: Id<"themes">;
  themeName: string;
  creatorCompleted: boolean;
  partnerCompleted: boolean;
}

interface GoalThemeListProps {
  themes: GoalTheme[];
  viewerRole: "creator" | "partner";
  isEditing: boolean;
  onToggle: (themeId: Id<"themes">) => void;
  onRemove: (themeId: Id<"themes">) => void;
}

export function GoalThemeList({
  themes,
  viewerRole,
  isEditing,
  onToggle,
  onRemove,
}: GoalThemeListProps) {
  if (themes.length === 0) {
    return (
      <div
        className="text-center p-8 border-2 rounded-2xl border-dashed"
        style={{
          borderColor: colors.primary.dark,
          backgroundColor: `${colors.background.elevated}CC`,
        }}
      >
        <p style={{ color: colors.text.DEFAULT }} className="text-sm font-semibold">
          No themes added yet
        </p>
        <p style={{ color: colors.text.DEFAULT }} className="text-xs mt-1 opacity-80">
          Add themes to track your learning progress
        </p>
      </div>
    );
  }

  return (
    <section
      className="rounded-2xl border-2 overflow-hidden"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      {themes.map((theme, index) => {
        const viewerCompleted =
          viewerRole === "creator" ? theme.creatorCompleted : theme.partnerCompleted;
        const partnerCompleted =
          viewerRole === "creator" ? theme.partnerCompleted : theme.creatorCompleted;
        const bothCompleted = theme.creatorCompleted && theme.partnerCompleted;

        return (
          <div
            key={theme.themeId}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom:
                index < themes.length - 1
                  ? `1px solid ${colors.primary.dark}`
                  : undefined,
              backgroundColor: bothCompleted ? `${colors.status.success.DEFAULT}10` : undefined,
            }}
            data-testid={`goal-theme-${theme.themeId}`}
          >
            {/* Index */}
            <span
              className="text-lg font-bold w-6 text-center"
              style={{ color: colors.text.muted }}
            >
              {index + 1}.
            </span>

            {/* Theme Name */}
            <div className="flex-1 min-w-0">
              <p
                className="font-semibold truncate"
                style={{
                  color: bothCompleted
                    ? colors.status.success.DEFAULT
                    : colors.text.DEFAULT,
                  textDecoration: bothCompleted ? "line-through" : undefined,
                }}
              >
                {theme.themeName}
              </p>
              {/* Completion indicators */}
              <div className="flex items-center gap-2 text-xs mt-0.5">
                <span
                  style={{
                    color: viewerCompleted
                      ? colors.status.success.DEFAULT
                      : colors.text.muted,
                  }}
                >
                  You: {viewerCompleted ? "✓" : "—"}
                </span>
                <span
                  style={{
                    color: partnerCompleted
                      ? colors.status.success.DEFAULT
                      : colors.text.muted,
                  }}
                >
                  Partner: {partnerCompleted ? "✓" : "—"}
                </span>
              </div>
            </div>

            {/* Checkbox for completion */}
            <button
              onClick={() => onToggle(theme.themeId)}
              className="w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-105"
              style={{
                borderColor: viewerCompleted
                  ? colors.status.success.DEFAULT
                  : colors.primary.dark,
                backgroundColor: viewerCompleted
                  ? colors.status.success.DEFAULT
                  : "transparent",
              }}
              title={viewerCompleted ? "Mark incomplete" : "Mark complete"}
              data-testid={`goal-theme-toggle-${theme.themeId}`}
            >
              {viewerCompleted && (
                <svg className="w-5 h-5" fill="white" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            {/* Delete button (only in editing mode) */}
            {isEditing && (
              <button
                onClick={() => onRemove(theme.themeId)}
                className="w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-105"
                style={{
                  borderColor: colors.status.danger.DEFAULT,
                  backgroundColor: `${colors.status.danger.DEFAULT}20`,
                }}
                title="Remove theme"
                data-testid={`goal-theme-remove-${theme.themeId}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke={colors.status.danger.DEFAULT}
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
