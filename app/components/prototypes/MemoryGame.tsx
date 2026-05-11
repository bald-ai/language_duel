"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MemoryGameStatus = "idle" | "playing" | "completed";
type MemoryCardLanguage = "english" | "spanish";
type MemoryPlayer = "P1" | "P2";

interface MemoryPair {
  pairId: string;
  english: string;
  spanish: string;
}

interface MemoryCard {
  id: string;
  pairId: string;
  text: string;
  language: MemoryCardLanguage;
}

const MEMORY_PLAYER_LANGUAGE: Record<MemoryPlayer, MemoryCardLanguage> = {
  P1: "english",
  P2: "spanish",
};

const MEMORY_GAME_PAIRS: MemoryPair[] = [
  { pairId: "mother", english: "mother", spanish: "madre" },
  { pairId: "father", english: "father", spanish: "padre" },
  { pairId: "brother", english: "brother", spanish: "hermano" },
  { pairId: "sister", english: "sister", spanish: "hermana" },
  { pairId: "son", english: "son", spanish: "hijo" },
  { pairId: "daughter", english: "daughter", spanish: "hija" },
];

const MEMORY_MISMATCH_DELAY_MS = 900;

function shuffleCards<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildMemoryDeck(): MemoryCard[] {
  const englishCards: MemoryCard[] = MEMORY_GAME_PAIRS.map((pair) => ({
    id: `${pair.pairId}-english`,
    pairId: pair.pairId,
    text: pair.english,
    language: "english" as const,
  }));
  const spanishCards: MemoryCard[] = MEMORY_GAME_PAIRS.map((pair) => ({
    id: `${pair.pairId}-spanish`,
    pairId: pair.pairId,
    text: pair.spanish,
    language: "spanish" as const,
  }));
  return [...shuffleCards(englishCards), ...shuffleCards(spanishCards)];
}

function formatElapsedTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface MemoryGameProps {
  onBack: () => void;
}

export function MemoryGame({ onBack }: MemoryGameProps) {
  const [cards, setCards] = useState<MemoryCard[]>(() => buildMemoryDeck());
  const [selectedCardIndexes, setSelectedCardIndexes] = useState<number[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isResolvingMismatch, setIsResolvingMismatch] = useState(false);
  const [status, setStatus] = useState<MemoryGameStatus>("idle");
  const [activePlayer, setActivePlayer] = useState<MemoryPlayer>("P1");
  const [roundStarter, setRoundStarter] = useState<MemoryPlayer>("P1");

  const reset = useCallback(() => {
    setCards(buildMemoryDeck());
    setSelectedCardIndexes([]);
    setMatchedPairIds([]);
    setMoves(0);
    setElapsedSeconds(0);
    setIsResolvingMismatch(false);
    setStatus("idle");
    setActivePlayer("P1");
    setRoundStarter("P1");
  }, []);

  const handleSelectCard = useCallback(
    (cardIndex: number) => {
      setSelectedCardIndexes((currentSelection) => {
        if (isResolvingMismatch || status === "completed") return currentSelection;
        if (currentSelection.includes(cardIndex)) return currentSelection;

        const card = cards[cardIndex];
        if (!card || matchedPairIds.includes(card.pairId)) return currentSelection;
        if (card.language !== MEMORY_PLAYER_LANGUAGE[activePlayer]) return currentSelection;

        if (status === "idle") setStatus("playing");

        if (currentSelection.length === 0) {
          setActivePlayer(activePlayer === "P1" ? "P2" : "P1");
          return [cardIndex];
        }

        if (currentSelection.length > 1) return currentSelection;

        const [firstCardIndex] = currentSelection;
        const firstCard = cards[firstCardIndex];
        if (!firstCard) return [cardIndex];

        const nextSelection = [firstCardIndex, cardIndex];
        const isMatch = firstCard.pairId === card.pairId && firstCard.language !== card.language;

        setMoves((currentMoves) => currentMoves + 1);

        const nextStarter: MemoryPlayer = roundStarter === "P1" ? "P2" : "P1";

        if (isMatch) {
          if (matchedPairIds.length + 1 === MEMORY_GAME_PAIRS.length) {
            setStatus("completed");
          }
          setMatchedPairIds((currentMatchedPairIds) => [...currentMatchedPairIds, card.pairId]);
          setRoundStarter(nextStarter);
          setActivePlayer(nextStarter);
          return [];
        }

        setIsResolvingMismatch(true);
        return nextSelection;
      });
    },
    [activePlayer, cards, isResolvingMismatch, matchedPairIds, roundStarter, status]
  );

  useEffect(() => {
    if (!isResolvingMismatch || selectedCardIndexes.length !== 2) return;

    const timeoutId = window.setTimeout(() => {
      const nextStarter: MemoryPlayer = roundStarter === "P1" ? "P2" : "P1";
      setSelectedCardIndexes([]);
      setIsResolvingMismatch(false);
      setRoundStarter(nextStarter);
      setActivePlayer(nextStarter);
    }, MEMORY_MISMATCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isResolvingMismatch, roundStarter, selectedCardIndexes]);

  useEffect(() => {
    if (status !== "playing") return;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [status]);

  const formattedElapsedTime = useMemo(() => formatElapsedTime(elapsedSeconds), [elapsedSeconds]);
  const revealedCardIndexes = useMemo(
    () =>
      new Set([
        ...selectedCardIndexes,
        ...cards
          .map((card, index) => (matchedPairIds.includes(card.pairId) ? index : -1))
          .filter((index) => index >= 0),
      ]),
    [cards, matchedPairIds, selectedCardIndexes]
  );

  const renderCard = (card: MemoryCard, index: number) => {
    const isMatched = matchedPairIds.includes(card.pairId);
    const isRevealed = revealedCardIndexes.has(index);
    const isPlayableByActive = card.language === MEMORY_PLAYER_LANGUAGE[activePlayer];
    const isLockedForOtherPlayer = !isMatched && !isRevealed && !isPlayableByActive;

    return (
      <button
        key={card.id}
        type="button"
        onClick={() => handleSelectCard(index)}
        data-testid={`memory-card-${index}`}
        disabled={
          isMatched ||
          isRevealed ||
          isResolvingMismatch ||
          status === "completed" ||
          isLockedForOtherPlayer
        }
        className="group relative aspect-[0.9] rounded-2xl text-left transition-transform duration-200"
        style={{
          perspective: "1000px",
          opacity: isMatched ? 0.9 : isLockedForOtherPlayer ? 0.55 : 1,
        }}
      >
        <div
          className="relative h-full w-full rounded-2xl transition-transform duration-300"
          style={{
            transformStyle: "preserve-3d",
            transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl border p-3 shadow-lg"
            style={{
              backfaceVisibility: "hidden",
              borderColor:
                card.language === "english"
                  ? "color-mix(in srgb, var(--color-primary) 24%, transparent)"
                  : "color-mix(in srgb, var(--color-cta) 24%, transparent)",
              background:
                card.language === "english"
                  ? "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 95%, black 5%) 0%, color-mix(in srgb, var(--color-primary-dark) 88%, black 12%) 100%)"
                  : "linear-gradient(180deg, color-mix(in srgb, var(--color-cta) 95%, black 5%) 0%, color-mix(in srgb, var(--color-cta-dark) 88%, black 12%) 100%)",
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{
                color:
                  card.language === "english"
                    ? "color-mix(in srgb, white 80%, var(--color-primary-light) 20%)"
                    : "color-mix(in srgb, white 80%, var(--color-cta-light) 20%)",
              }}
            >
              {card.language === "english" ? "P1 · EN" : "P2 · ES"}
            </span>
            <span className="text-2xl font-black" style={{ color: "white" }}>
              ?
            </span>
          </div>

          <div
            className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl border p-3 shadow-lg"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              borderColor: isMatched
                ? "color-mix(in srgb, var(--color-cta) 28%, transparent)"
                : "color-mix(in srgb, var(--color-primary) 32%, white 10%)",
              background:
                card.language === "english"
                  ? "linear-gradient(180deg, color-mix(in srgb, var(--color-primary-light) 30%, white 70%) 0%, color-mix(in srgb, var(--color-background-elevated) 88%, white 12%) 100%)"
                  : "linear-gradient(180deg, color-mix(in srgb, var(--color-cta-light) 28%, white 72%) 0%, color-mix(in srgb, var(--color-background-elevated) 88%, white 12%) 100%)",
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: card.language === "english" ? "var(--color-primary-dark)" : "var(--color-cta-dark)" }}
            >
              {card.language === "english" ? "English" : "Spanish"}
            </span>
            <span
              className="text-base font-black leading-tight sm:text-lg"
              style={{ color: "var(--color-text)" }}
            >
              {card.text}
            </span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <main className="relative z-10 flex flex-1 w-full items-start justify-center px-4 pt-20 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <section
        className="w-full max-w-[760px] rounded-[28px] border p-4 sm:p-5 shadow-2xl backdrop-blur-md animate-slide-up"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-background-elevated) 82%, white 18%) 0%, color-mix(in srgb, var(--color-background-elevated) 90%, transparent) 100%)",
          borderColor: "color-mix(in srgb, var(--color-primary) 22%, white 24%)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            data-testid="memory-game-back"
            className="rounded-full border px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] transition-colors"
            style={{
              color: "var(--color-text)",
              borderColor: "color-mix(in srgb, var(--color-primary) 40%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 65%, transparent)",
            }}
          >
            Back
          </button>

          <div className="text-right">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.28em]"
              style={{ color: "var(--color-primary-dark)" }}
            >
              Coop Prototype
            </p>
            <h2 className="title-font text-3xl leading-none" style={{ color: "var(--color-text)" }}>
              Memory Game
            </h2>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div
            className="rounded-2xl border px-3 py-2.5"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary-light) 24%, white 76%)",
              borderColor: "color-mix(in srgb, var(--color-primary) 32%, white 10%)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-primary-dark)" }}>
              Rounds
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {moves}
            </p>
          </div>

          <div
            className="rounded-2xl border px-3 py-2.5"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-cta-light) 26%, white 74%)",
              borderColor: "color-mix(in srgb, var(--color-cta) 18%, transparent)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-cta-dark)" }}>
              Time
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {formattedElapsedTime}
            </p>
          </div>

          <div
            className="rounded-2xl border px-3 py-2.5"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-neutral) 14%, white 86%)",
              borderColor: "color-mix(in srgb, var(--color-neutral) 32%, transparent)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-text)" }}>
              Pairs
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {matchedPairIds.length}/{MEMORY_GAME_PAIRS.length}
            </p>
          </div>
        </div>

        <div
          className="mt-4 rounded-2xl border px-4 py-3"
          style={{
            backgroundColor:
              status === "completed"
                ? "color-mix(in srgb, var(--color-cta-light) 18%, white 82%)"
                : "color-mix(in srgb, var(--color-background-elevated) 72%, transparent)",
            borderColor:
              status === "completed"
                ? "color-mix(in srgb, var(--color-cta) 28%, transparent)"
                : "color-mix(in srgb, var(--color-primary) 14%, transparent)",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {status === "idle" && "P1 picks an English card, P2 picks the matching Spanish card. Work together!"}
            {status === "playing" && !isResolvingMismatch &&
              (activePlayer === "P1"
                ? "P1's turn — flip an English card."
                : "P2's turn — flip a Spanish card.")}
            {status === "playing" && isResolvingMismatch && "Not a match. Cards flip back in a moment — try again together."}
            {status === "completed" && `You cleared the board together in ${moves} rounds and ${formattedElapsedTime}.`}
          </p>
        </div>

        <div
          className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-5"
          data-testid="memory-game-boards"
        >
          <div
            className="rounded-2xl border p-3 sm:p-4"
            data-testid="memory-board-english"
            style={{
              backgroundColor:
                activePlayer === "P1"
                  ? "color-mix(in srgb, var(--color-primary-light) 18%, white 82%)"
                  : "color-mix(in srgb, var(--color-primary-light) 6%, white 94%)",
              borderColor:
                activePlayer === "P1"
                  ? "color-mix(in srgb, var(--color-primary) 50%, white 10%)"
                  : "color-mix(in srgb, var(--color-primary) 18%, white 10%)",
              boxShadow:
                activePlayer === "P1"
                  ? "0 8px 24px color-mix(in srgb, var(--color-primary) 22%, transparent)"
                  : "none",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ color: "var(--color-primary-dark)" }}
              >
                P1 · English
              </p>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{
                  color:
                    activePlayer === "P1"
                      ? "var(--color-primary-dark)"
                      : "color-mix(in srgb, var(--color-text) 45%, transparent)",
                }}
              >
                {activePlayer === "P1" ? "Active" : "Waiting"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {cards
                .map((card, index) => ({ card, index }))
                .filter(({ card }) => card.language === "english")
                .map(({ card, index }) => renderCard(card, index))}
            </div>
          </div>

          <div
            className="rounded-2xl border p-3 sm:p-4"
            data-testid="memory-board-spanish"
            style={{
              backgroundColor:
                activePlayer === "P2"
                  ? "color-mix(in srgb, var(--color-cta-light) 18%, white 82%)"
                  : "color-mix(in srgb, var(--color-cta-light) 6%, white 94%)",
              borderColor:
                activePlayer === "P2"
                  ? "color-mix(in srgb, var(--color-cta) 45%, white 10%)"
                  : "color-mix(in srgb, var(--color-cta) 16%, white 10%)",
              boxShadow:
                activePlayer === "P2"
                  ? "0 8px 24px color-mix(in srgb, var(--color-cta) 22%, transparent)"
                  : "none",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ color: "var(--color-cta-dark)" }}
              >
                P2 · Spanish
              </p>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{
                  color:
                    activePlayer === "P2"
                      ? "var(--color-cta-dark)"
                      : "color-mix(in srgb, var(--color-text) 45%, transparent)",
                }}
              >
                {activePlayer === "P2" ? "Active" : "Waiting"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {cards
                .map((card, index) => ({ card, index }))
                .filter(({ card }) => card.language === "spanish")
                .map(({ card, index }) => renderCard(card, index))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            data-testid="memory-game-play-again"
            className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] transition-transform duration-200 hover:translate-y-0.5"
            style={{
              color: "white",
              borderColor: "var(--color-cta-light)",
              background:
                "linear-gradient(to bottom, var(--color-cta) 0%, var(--color-cta-dark) 100%)",
              boxShadow: "0 10px 24px color-mix(in srgb, var(--color-cta) 38%, transparent)",
            }}
          >
            Play Again
          </button>

          <button
            type="button"
            onClick={onBack}
            data-testid="memory-game-home"
            className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] transition-colors"
            style={{
              color: "var(--color-text)",
              borderColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 72%, transparent)",
            }}
          >
            Back to Home
          </button>
        </div>
      </section>
    </main>
  );
}
