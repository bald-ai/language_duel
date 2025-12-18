"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
  NICKNAME_REGEX,
  NICKNAME_ERRORS,
} from "../constants";

export function useNicknameUpdate() {
  const updateNicknameMutation = useMutation(api.users.updateNickname);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateNickname = useCallback((nickname: string): string | null => {
    if (nickname.length < NICKNAME_MIN_LENGTH) {
      return NICKNAME_ERRORS.TOO_SHORT;
    }
    if (nickname.length > NICKNAME_MAX_LENGTH) {
      return NICKNAME_ERRORS.TOO_LONG;
    }
    if (!NICKNAME_REGEX.test(nickname)) {
      return NICKNAME_ERRORS.INVALID_CHARS;
    }
    return null;
  }, []);

  const updateNickname = useCallback(
    async (nickname: string) => {
      const validationError = validateNickname(nickname);
      if (validationError) {
        setError(validationError);
        return false;
      }

      setError(null);
      setIsUpdating(true);

      try {
        const result = await updateNicknameMutation({ nickname });
        toast.success(`Nickname updated to ${result.nickname}#${result.discriminator}`);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update nickname";
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [updateNicknameMutation, validateNickname]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    updateNickname,
    isUpdating,
    error,
    clearError,
    validateNickname,
  };
}

