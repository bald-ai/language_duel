"use client";

import { useState, useCallback } from "react";
import { NICKNAME_MAX_LENGTH } from "../constants";

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
    <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-300 mb-4">Change Nickname</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nickname" className="block text-sm text-gray-400 mb-2">
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
              className="w-full px-4 py-3 bg-gray-700 border-2 border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors disabled:opacity-50"
            />
            {currentDiscriminator && nickname.trim() && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                #{currentDiscriminator}*
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * A new random discriminator will be assigned when you change your nickname
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isUpdating || !hasChanged || !nickname.trim()}
          className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold uppercase hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUpdating ? "Updating..." : "Update Nickname"}
        </button>
      </form>
    </div>
  );
}

