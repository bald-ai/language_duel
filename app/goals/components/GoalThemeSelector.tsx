"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";

interface GoalThemeSelectorProps {
  goalId: Id<"weeklyGoals">;
  currentThemeCount: number;
  onSelect: (themeIds: Id<"themes">[]) => void;
  onClose: () => void;
}

export function GoalThemeSelector({
  goalId,
  currentThemeCount,
  onSelect,
  onClose,
}: GoalThemeSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<Id<"themes">>>(new Set());
  const eligibleThemes = useQuery(api.weeklyGoals.getEligibleThemes, { goalId });

  const maxCanAdd = 5 - currentThemeCount;
  const canAddMore = selectedIds.size < maxCanAdd;

  const toggleTheme = (themeId: Id<"themes">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else if (next.size < maxCanAdd) {
        next.add(themeId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size > 0) {
      onSelect(Array.from(selectedIds));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-md max-h-[80vh] rounded-2xl border-2 overflow-hidden flex flex-col"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b-2 flex items-center justify-between"
          style={{ borderColor: colors.primary.dark }}
        >
          <div>
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{ color: colors.text.DEFAULT }}
            >
              Add Themes
            </h2>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              Select up to {maxCanAdd} theme{maxCanAdd !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
            style={{
              backgroundColor: colors.background.DEFAULT,
            }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke={colors.text.muted}
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {eligibleThemes === undefined ? (
            <div className="text-center py-8">
              <p style={{ color: colors.text.muted }}>Loading themes...</p>
            </div>
          ) : eligibleThemes.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p style={{ color: colors.text.muted }}>
                No eligible themes available
              </p>
              <p className="text-sm" style={{ color: colors.text.muted }}>
                Themes must be shared and owned by you or your partner
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {eligibleThemes.map((theme) => {
                const isSelected = selectedIds.has(theme._id);
                const isDisabled = !isSelected && !canAddMore;

                return (
                  <button
                    key={theme._id}
                    onClick={() => toggleTheme(theme._id)}
                    disabled={isDisabled}
                    className="w-full text-left p-4 rounded-xl border-2 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: isSelected
                        ? `${colors.cta.DEFAULT}1A`
                        : colors.background.DEFAULT,
                      borderColor: isSelected
                        ? colors.cta.DEFAULT
                        : colors.primary.dark,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-semibold"
                          style={{
                            color: isSelected
                              ? colors.cta.light
                              : colors.text.DEFAULT,
                          }}
                        >
                          {theme.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-xs"
                            style={{ color: colors.text.muted }}
                          >
                            {theme.words.length} words
                          </span>
                          {theme.description && (
                            <>
                              <span style={{ color: colors.text.muted }}>•</span>
                              <span
                                className="text-xs truncate"
                                style={{ color: colors.text.muted }}
                              >
                                {theme.description}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Checkbox */}
                      <div
                        className="w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ml-3"
                        style={{
                          borderColor: isSelected
                            ? colors.cta.DEFAULT
                            : colors.primary.dark,
                          backgroundColor: isSelected
                            ? colors.cta.DEFAULT
                            : "transparent",
                        }}
                      >
                        {isSelected && (
                          <svg
                            className="w-4 h-4"
                            fill="white"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 border-t-2 flex gap-3"
          style={{ borderColor: colors.primary.dark }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wide border-2 transition-all hover:opacity-80"
            style={{
              borderColor: colors.primary.dark,
              color: colors.text.muted,
              backgroundColor: "transparent",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: colors.cta.DEFAULT,
              color: colors.text.DEFAULT,
            }}
          >
            Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
