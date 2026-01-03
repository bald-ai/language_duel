"use client";

import { useState, useCallback } from "react";
import { NICKNAME_MAX_LENGTH } from "../constants";
import { colors } from "@/lib/theme";

interface NicknameEditorProps {
  currentNickname?: string;
  currentDiscriminator?: number;
  isUpdating: boolean;
  error: string | null;
  onUpdate: (nickname: string) => Promise<boolean>;
  onClearError: () => void;
}

export function NicknameEditor({
  currentNickname,
  currentDiscriminator,
  isUpdating,
  error,
  onUpdate,
  onClearError,
}: NicknameEditorProps) {
  const [nickname, setNickname] = useState(currentNickname || "");

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onClearError();
      setNickname(e.target.value);
    },
    [onClearError]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await onUpdate(nickname.trim());
      if (success) {
        // Reset to show new nickname from server
        setNickname(nickname.trim());
      }
    },
    [nickname, onUpdate]
  );

  const hasChanged = nickname.trim() !== (currentNickname || "");

  return (
    <div 
      className="rounded-2xl p-6 border-2"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <h3 
        className="text-lg font-bold mb-4"
        style={{ color: colors.text.DEFAULT }}
      >
        Change Nickname
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="nickname" 
            className="block text-sm mb-2"
            style={{ color: colors.text.muted }}
          >
            New Nickname
          </label>
          <div className="relative">
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={handleInputChange}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="Enter nickname..."
              disabled={isUpdating}
              className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none transition-colors disabled:opacity-50"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.light,
                color: colors.text.DEFAULT,
              }}
            />
            {currentDiscriminator && nickname.trim() && (
              <span 
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: colors.text.muted }}
              >
                #{currentDiscriminator}*
              </span>
            )}
          </div>
          <p className="text-xs mt-2" style={{ color: colors.text.muted }}>
            * A new random discriminator will be assigned when you change your nickname
          </p>
        </div>

        {error && (
          <div 
            className="p-3 rounded-lg border"
            style={{
              backgroundColor: `${colors.cta.dark}20`,
              borderColor: `${colors.cta.DEFAULT}50`,
            }}
          >
            <p className="text-sm" style={{ color: colors.cta.light }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isUpdating || !hasChanged || !nickname.trim()}
          className="w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: colors.primary.DEFAULT,
            color: "white",
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          {isUpdating ? "Updating..." : "Update Nickname"}
        </button>
      </form>
    </div>
  );
}
