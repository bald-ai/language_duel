"use client";

import { useEffect, useRef, useState } from "react";

interface UseTwoOptionKeyboardParams<T extends string> {
  enabled: boolean;
  primaryOption: T;
  secondaryOption: T;
  defaultOption: T;
  onConfirm: (selectedOption: T) => void;
}

/**
 * Shared keyboard controller for two-option flows.
 * Supports left/right/up/down toggle and Enter confirm.
 */
export function useTwoOptionKeyboard<T extends string>({
  enabled,
  primaryOption,
  secondaryOption,
  defaultOption,
  onConfirm,
}: UseTwoOptionKeyboardParams<T>) {
  const [selectedOption, setSelectedOption] = useState<T>(defaultOption);
  const selectedOptionRef = useRef<T>(defaultOption);
  const onConfirmRef = useRef(onConfirm);

  useEffect(() => {
    selectedOptionRef.current = selectedOption;
  }, [selectedOption]);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isToggleKey =
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown";

      if (isToggleKey) {
        e.preventDefault();
        setSelectedOption((prev) => (prev === primaryOption ? secondaryOption : primaryOption));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        onConfirmRef.current(selectedOptionRef.current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, primaryOption, secondaryOption]);

  return {
    selectedOption,
    setSelectedOption,
  };
}
