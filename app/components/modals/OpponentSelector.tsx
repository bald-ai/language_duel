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
      className="w-full text-left px-4 py-3 rounded-xl border-2 transition hover:brightness-[0.97] flex items-center justify-between"
      style={{
        backgroundColor: isMeSelected ? `${colors.cta.DEFAULT}1A` : colors.background.DEFAULT,
        borderColor: isMeSelected ? colors.cta.DEFAULT : "transparent",
      }}
      data-testid="duel-modal-opponent-me"
    >
      <div className="min-w-0">
        <div
          className="font-semibold text-sm truncate"
          style={{ color: isMeSelected ? colors.cta.dark : colors.text.DEFAULT }}
          title="Solo practice"
        >
          Solo practice
        </div>
        <div className="text-xs" style={{ color: colors.text.muted }}>
          Duel yourself — practice mode
        </div>
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
          className="text-center p-4 rounded-xl"
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
          className="text-center p-4 rounded-xl"
          style={{
            backgroundColor: colors.background.DEFAULT,
            color: colors.text.muted,
          }}
        >
          <p className="text-sm">No other users available to duel.</p>
        </div>
      );
    }

    return users.map((user) => {
      const isSelected = selectedOpponentId === user._id;
      return (
        <button
          key={user._id}
          onClick={() => onSelect(user._id)}
          className="w-full text-left px-4 py-3 rounded-xl border-2 transition hover:brightness-[0.97] flex items-center justify-between"
          style={{
            backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : colors.background.DEFAULT,
            borderColor: isSelected ? colors.cta.DEFAULT : "transparent",
          }}
          data-testid={`duel-modal-opponent-${user._id}`}
        >
          <div
            className="font-semibold text-sm truncate"
            style={{ color: isSelected ? colors.cta.dark : colors.text.DEFAULT }}
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
      ? "Solo practice"
      : formatVisibleUser(selectedOpponent, "Unknown")
    : null;

  return (
    <div>
      <div className="max-h-44 overflow-y-auto space-y-2 pr-0.5">
        {meRow}
        {friendsBody}
      </div>
      {selectedLabel && (
        <div
          className="pt-2.5 text-center text-xs"
          style={{ color: colors.text.muted }}
        >
          Selected: <span style={{ color: colors.cta.dark }}>{selectedLabel}</span>
        </div>
      )}
    </div>
  );
});
