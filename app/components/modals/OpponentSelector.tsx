"use client";

import { memo } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser } from "@/lib/userDisplay";
import { CheckmarkIcon } from "./CheckmarkIcon";
import type { LobbyUser } from "@/hooks/challengeLobby/types";

interface OpponentSelectorProps {
  users: LobbyUser[] | undefined;
  viewer: LobbyUser | null | undefined;
  selectedOpponentId: Id<"users"> | null;
  selectedOpponent: LobbyUser | null;
  onSelect: (id: Id<"users">) => void;
}

export const OpponentSelector = memo(function OpponentSelector({
  users,
  viewer,
  selectedOpponentId,
  selectedOpponent,
  onSelect,
}: OpponentSelectorProps) {
  const colors = useAppearanceColors();

  const meRowVisible = viewer != null;
  const isMeSelected = meRowVisible && selectedOpponentId === viewer._id;

  const meRow = meRowVisible ? (
    <button
      key="self"
      onClick={() => onSelect(viewer._id)}
      className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
      style={{
        backgroundColor: isMeSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
        borderBottom: `1px solid ${colors.primary.dark}`,
      }}
      data-testid="duel-modal-opponent-me"
    >
      <div
        className="font-semibold text-sm truncate"
        style={{ color: isMeSelected ? colors.cta.light : colors.text.DEFAULT }}
        title="Me"
      >
        Me
      </div>
      {isMeSelected && (
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ml-2"
          style={{ backgroundColor: colors.cta.DEFAULT }}
        >
          <CheckmarkIcon />
        </div>
      )}
    </button>
  ) : null;

  const friendsBody = (() => {
    if (!users) {
      return (
        <div
          className="text-center p-4"
          style={{
            backgroundColor: colors.background.DEFAULT,
            color: colors.text.muted,
          }}
        >
          <p className="text-sm">Loading opponents...</p>
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <div
          className="text-center p-4"
          style={{
            backgroundColor: colors.background.DEFAULT,
            color: colors.text.muted,
          }}
        >
          <p className="text-sm">No other users available to duel.</p>
        </div>
      );
    }

    return users.map((user, index) => {
      const isSelected = selectedOpponentId === user._id;
      return (
        <button
          key={user._id}
          onClick={() => onSelect(user._id)}
          className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
          style={{
            backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
            borderBottom: index < users.length - 1 ? `1px solid ${colors.primary.dark}` : undefined,
          }}
          data-testid={`duel-modal-opponent-${user._id}`}
        >
          <div
            className="font-semibold text-sm truncate"
            style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
            title={formatVisibleUser(user, "Unknown")}
          >
            {formatVisibleUser(user, "Unknown")}
          </div>
          {isSelected && (
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ml-2"
              style={{ backgroundColor: colors.cta.DEFAULT }}
            >
              <CheckmarkIcon />
            </div>
          )}
        </button>
      );
    });
  })();

  const selectedLabel = selectedOpponent
    ? isMeSelected
      ? "Me"
      : formatVisibleUser(selectedOpponent, "Unknown")
    : null;

  return (
    <div
      className="border-2 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="max-h-40 overflow-y-auto">
        {meRow}
        {friendsBody}
      </div>
      {selectedLabel && (
        <div
          className="px-4 py-2 text-center text-xs"
          style={{
            backgroundColor: colors.background.elevated,
            borderTop: `1px solid ${colors.primary.dark}`,
            color: colors.text.muted,
          }}
        >
          Selected: <span style={{ color: colors.cta.light }}>{selectedLabel}</span>
        </div>
      )}
    </div>
  );
});
