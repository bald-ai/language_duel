import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { SoloSentenceBankChip } from "@/lib/soloSentenceRuntime";

const ARROW_DIRECTIONS: Readonly<Record<string, 1 | -1 | undefined>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** Navigate available chips; recognition and completed answers own their own keys. */
export function useSentenceClozeKeyboard({
  disabled, bank, usedChipIds, selectedChipIndex, setSelectedChipIndex, placeChip,
}: {
  disabled: boolean;
  bank: SoloSentenceBankChip[];
  usedChipIds: ReadonlySet<string>;
  selectedChipIndex: number;
  setSelectedChipIndex: Dispatch<SetStateAction<number>>;
  placeChip: (chip: SoloSentenceBankChip) => void;
}) {
  useEffect(() => {
    if (disabled) return;
    const available = bank
      .map((chip, index) => ({ chip, index }))
      .filter(({ chip }) => !usedChipIds.has(chip.id))
      .map(({ index }) => index);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (available.length === 0) return;
      const direction = ARROW_DIRECTIONS[event.key];
      if (direction) {
        event.preventDefault();
        setSelectedChipIndex((previous) => {
          const position = available.indexOf(previous);
          if (direction === 1) return available[(position + 1) % available.length];
          const base = position === -1 ? available.length : position;
          return available[(base - 1 + available.length) % available.length];
        });
      } else if (event.key === "Enter") {
        event.preventDefault();
        const chip = bank[selectedChipIndex];
        if (chip && !usedChipIds.has(chip.id)) placeChip(chip);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, bank, usedChipIds, selectedChipIndex, setSelectedChipIndex, placeChip]);
}
