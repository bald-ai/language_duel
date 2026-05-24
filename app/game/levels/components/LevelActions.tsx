"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  getLevelPrimaryActionStyle,
  getLevelSecondaryActionStyle,
  levelActionButtonClassName,
} from "../levelButtonStyles";

interface LevelActionsProps {
  onSkip: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
  dataTestIdBase?: string;
  /** Suffix for the confirm button's testid (some levels use "submit"). */
  confirmTestId?: string;
}

/**
 * The shared "Don't Know" + "Confirm" footer used by the typing and
 * multiple-choice level inputs.
 */
export function LevelActions({
  onSkip,
  onConfirm,
  confirmDisabled,
  dataTestIdBase,
  confirmTestId = "confirm",
}: LevelActionsProps) {
  const colors = useAppearanceColors();

  return (
    <div className="flex gap-3">
      <button
        onClick={onSkip}
        className="px-4 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110"
        style={getLevelSecondaryActionStyle(colors)}
        data-testid={dataTestIdBase ? `${dataTestIdBase}-skip` : undefined}
      >
        Don&apos;t Know
      </button>
      <button
        onClick={onConfirm}
        disabled={confirmDisabled}
        className={levelActionButtonClassName}
        style={getLevelPrimaryActionStyle(colors)}
        data-testid={dataTestIdBase ? `${dataTestIdBase}-${confirmTestId}` : undefined}
      >
        Confirm
      </button>
    </div>
  );
}
