"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";

/**
 * Relay Duel (mock prototype).
 *
 * Vision: a turn-based twist on the real PVP duel. Instead of both players
 * answering every word, the two players SHARE one pool of words and take turns
 * handing words to each other:
 *
 *   Player 1 picks a word for Player 2  ->  Player 2 answers it  ->
 *   Player 2 picks a word for Player 1  ->  Player 1 answers it  ->  ...
 *
 * ...until the whole pool (all words from the chosen themes) is exhausted.
 * The picker can see each word's difficulty, so there is strategy in handing
 * your rival the nastiest words. Whoever answers correctly banks the points.
 *
 * This is a single-device pass-and-play UI mock that reuses the duel's themed
 * card, scoreboard and answer grid. No timer, no backend, no real matchmaking.
 */

type Difficulty = "easy" | "medium" | "hard";

const POINTS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

interface Word {
  id: string;
  theme: string;
  /** Source word shown as the prompt. */
  prompt: string;
  /** Correct translation. */
  answer: string;
  /** Three wrong options. */
  distractors: string[];
  difficulty: Difficulty;
}

const WORDS: Word[] = [
  { id: "airport", theme: "Travel", prompt: "airport", answer: "aeropuerto", distractors: ["estación", "puerto", "frontera"], difficulty: "hard" },
  { id: "ticket", theme: "Travel", prompt: "ticket", answer: "billete", distractors: ["maleta", "asiento", "puerta"], difficulty: "medium" },
  { id: "map", theme: "Travel", prompt: "map", answer: "mapa", distractors: ["carta", "calle", "libro"], difficulty: "easy" },
  { id: "luggage", theme: "Travel", prompt: "luggage", answer: "equipaje", distractors: ["paquete", "mochila", "bolsa"], difficulty: "hard" },
  { id: "bread", theme: "Food", prompt: "bread", answer: "pan", distractors: ["leche", "queso", "huevo"], difficulty: "easy" },
  { id: "water", theme: "Food", prompt: "water", answer: "agua", distractors: ["vino", "zumo", "café"], difficulty: "easy" },
  { id: "spicy", theme: "Food", prompt: "spicy", answer: "picante", distractors: ["dulce", "salado", "amargo"], difficulty: "medium" },
  { id: "breakfast", theme: "Food", prompt: "breakfast", answer: "desayuno", distractors: ["almuerzo", "cena", "merienda"], difficulty: "hard" },
];

type PlayerId = "p1" | "p2";

const PLAYER_NAMES: Record<PlayerId, string> = { p1: "Player 1", p2: "Player 2" };

const otherPlayer = (p: PlayerId): PlayerId => (p === "p1" ? "p2" : "p1");

type Phase = "pick" | "handoff" | "answer" | "feedback" | "done";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface RelayDuelBetaProps {
  onBack: () => void;
}

export function RelayDuelBeta({ onBack }: RelayDuelBetaProps) {
  const colors = useAppearanceColors();

  const [phase, setPhase] = useState<Phase>("pick");
  const [picker, setPicker] = useState<PlayerId>("p1");
  const [remaining, setRemaining] = useState<Word[]>(WORDS);
  const [scores, setScores] = useState<Record<PlayerId, number>>({ p1: 0, p2: 0 });
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [assignedWord, setAssignedWord] = useState<Word | null>(null);
  const [activeOptions, setActiveOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const answerer = otherPlayer(picker);
  // The device-holder ("You") is whoever is currently acting on screen.
  const actor: PlayerId = phase === "pick" ? picker : phase === "done" ? "p1" : answerer;
  const total = WORDS.length;
  const answeredCount = total - remaining.length;
  const isCorrect = assignedWord ? selectedAnswer === assignedWord.answer : false;

  const handleSelectWord = useCallback(
    (id: string) => {
      if (phase !== "pick") return;
      setSelectedWordId(id);
    },
    [phase]
  );

  const handleSend = useCallback(() => {
    const word = remaining.find((w) => w.id === selectedWordId);
    if (!word) return;
    setAssignedWord(word);
    setActiveOptions(shuffle([word.answer, ...word.distractors]));
    setRemaining((current) => current.filter((w) => w.id !== word.id));
    setSelectedWordId(null);
    setSelectedAnswer(null);
    setPhase("handoff");
  }, [remaining, selectedWordId]);

  const handleReady = useCallback(() => setPhase("answer"), []);

  const handleSelectAnswer = useCallback(
    (option: string) => {
      if (phase !== "answer") return;
      setSelectedAnswer(option);
    },
    [phase]
  );

  const handleConfirm = useCallback(() => {
    if (!assignedWord || !selectedAnswer) return;
    if (selectedAnswer === assignedWord.answer) {
      setScores((current) => ({ ...current, [answerer]: current[answerer] + POINTS[assignedWord.difficulty] }));
    }
    setPhase("feedback");
  }, [assignedWord, selectedAnswer, answerer]);

  const handleContinue = useCallback(() => {
    if (remaining.length === 0) {
      setPhase("done");
      return;
    }
    // Whoever just answered now becomes the picker (device stays with them).
    setPicker(answerer);
    setAssignedWord(null);
    setActiveOptions([]);
    setSelectedAnswer(null);
    setPhase("pick");
  }, [remaining.length, answerer]);

  const handleRestart = useCallback(() => {
    setPhase("pick");
    setPicker("p1");
    setRemaining(WORDS);
    setScores({ p1: 0, p2: 0 });
    setSelectedWordId(null);
    setAssignedWord(null);
    setActiveOptions([]);
    setSelectedAnswer(null);
  }, []);

  // ---- Styles mirrored from DuelView ----
  const gameContainerStyle = {
    "--duel-bg": `${colors.background.DEFAULT}E6`,
    "--duel-bg-elevated": `${colors.background.elevated}80`,
    borderColor: colors.primary.dark,
  } as CSSProperties;
  const subtleBorderStyle = { borderColor: `${colors.primary.dark}80` };
  const mutedTextStyle = { color: colors.text.muted };
  const exitButtonStyle = { backgroundColor: colors.status.danger.DEFAULT, color: colors.text.inverse };

  const levelStyles: Record<Difficulty, CSSProperties> = {
    easy: { color: colors.status.success.light, backgroundColor: `${colors.status.success.DEFAULT}33`, borderColor: colors.status.success.DEFAULT },
    medium: { color: colors.status.warning.light, backgroundColor: `${colors.status.warning.DEFAULT}33`, borderColor: colors.status.warning.DEFAULT },
    hard: { color: colors.status.danger.light, backgroundColor: `${colors.status.danger.DEFAULT}33`, borderColor: colors.status.danger.DEFAULT },
  };
  const renderPill = (difficulty: Difficulty) => (
    <span className="inline-block px-3 py-1 rounded-full border text-sm font-medium" style={levelStyles[difficulty]}>
      {difficulty.toUpperCase()} (+{POINTS[difficulty]} pts)
    </span>
  );

  const wordCardStyle = (id: string): CSSProperties =>
    selectedWordId === id
      ? { borderColor: colors.secondary.DEFAULT, backgroundColor: `${colors.secondary.DEFAULT}26`, color: colors.secondary.dark }
      : { borderColor: colors.primary.dark, backgroundColor: colors.background.elevated, color: colors.text.DEFAULT };

  const optionStyle = (option: string, showFeedback: boolean): CSSProperties => {
    const selected = selectedAnswer === option;
    const correct = assignedWord ? option === assignedWord.answer : false;
    if (showFeedback) {
      if (correct) {
        return {
          borderColor: colors.status.success.DEFAULT,
          backgroundColor: `${colors.status.success.DEFAULT}${selected ? "26" : "1A"}`,
          color: colors.status.success.dark,
        };
      }
      if (selected) {
        return { borderColor: colors.status.danger.DEFAULT, backgroundColor: `${colors.status.danger.DEFAULT}26`, color: colors.status.danger.dark };
      }
      return { borderColor: colors.neutral.dark, backgroundColor: colors.background.DEFAULT, color: colors.text.muted };
    }
    if (selected) {
      return { borderColor: colors.secondary.DEFAULT, backgroundColor: `${colors.secondary.DEFAULT}26`, color: colors.secondary.dark };
    }
    return { borderColor: colors.primary.dark, backgroundColor: colors.background.elevated, color: colors.text.DEFAULT };
  };

  const ctaEnabledStyle = { backgroundColor: colors.cta.DEFAULT, borderBottomColor: colors.cta.dark, color: colors.text.DEFAULT };
  const ctaDisabledStyle = { backgroundColor: colors.background.elevated, borderBottomColor: colors.neutral.dark, color: colors.text.muted };
  const footerButtonClass =
    "w-full rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 hover:brightness-110";

  const pickerName = PLAYER_NAMES[picker];
  const answererName = PLAYER_NAMES[answerer];
  const showFeedback = phase === "feedback";
  const showAnswerScreen = phase === "answer" || phase === "feedback";

  const winner = scores.p1 === scores.p2 ? "tie" : scores.p1 > scores.p2 ? "p1" : "p2";

  return (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
    >
      {/* Game Container - full screen on mobile, centered card on desktop */}
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] bg-[var(--duel-bg)] md:bg-[var(--duel-bg-elevated)]"
        style={gameContainerStyle}
      >
        {/* Header: Scoreboard + Exit */}
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 border-b"
          style={subtleBorderStyle}
        >
          <Scoreboard
            myName={PLAYER_NAMES[actor]}
            theirName={PLAYER_NAMES[otherPlayer(actor)]}
            myScore={scores[actor]}
            theirScore={scores[otherPlayer(actor)]}
          />
          <button
            onClick={onBack}
            className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
            style={exitButtonStyle}
            data-testid="relay-duel-exit"
          >
            Exit Duel
          </button>
        </header>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
          {/* ---- PICK PHASE ---- */}
          {phase === "pick" && (
            <>
              <div className="text-center mb-3">
                <div className="text-sm mb-1" style={mutedTextStyle}>
                  {remaining.length} {remaining.length === 1 ? "word" : "words"} left in the shared pool
                </div>
                <div className="text-xl md:text-2xl font-bold">
                  {pickerName}, hand a word to {answererName}
                </div>
                <div className="text-sm mt-1" style={mutedTextStyle}>
                  Tap a word — pick wisely, harder words are worth more if they get it right.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
                {remaining.map((word) => (
                  <button
                    key={word.id}
                    type="button"
                    onClick={() => handleSelectWord(word.id)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all hover:brightness-110"
                    style={wordCardStyle(word.id)}
                    data-testid={`relay-duel-pick-${word.id}`}
                  >
                    <span className="text-[11px] uppercase tracking-[0.2em]" style={mutedTextStyle}>
                      {word.theme}
                    </span>
                    <span className="text-lg font-bold">{word.prompt}</span>
                    {renderPill(word.difficulty)}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ---- HANDOFF PHASE ---- */}
          {phase === "handoff" && (
            <div className="text-center px-4">
              <div className="text-5xl mb-4">🤝</div>
              <div className="text-2xl md:text-3xl font-bold mb-2">Pass the device to {answererName}</div>
              <div className="text-base" style={mutedTextStyle}>
                {pickerName} picked a word for you to translate.
              </div>
            </div>
          )}

          {/* ---- ANSWER / FEEDBACK PHASE ---- */}
          {showAnswerScreen && assignedWord && (
            <>
              <div className="text-center mb-3">
                <div className="text-sm mb-1" style={mutedTextStyle}>
                  Word #{answeredCount} of {total}
                </div>
                <div>{renderPill(assignedWord.difficulty)}</div>
              </div>

              <div className="text-center mb-4">
                <div className="text-xs uppercase tracking-[0.25em] mb-2" style={mutedTextStyle}>
                  {assignedWord.theme} · from {pickerName}
                </div>
                <div className="text-2xl md:text-3xl font-bold">{assignedWord.prompt}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
                {activeOptions.map((option, i) => {
                  const selected = selectedAnswer === option;
                  const correct = option === assignedWord.answer;
                  const dimmed = showFeedback && !correct && !selected;
                  return (
                    <button
                      key={`${option}-${i}`}
                      type="button"
                      onClick={() => handleSelectAnswer(option)}
                      disabled={showFeedback}
                      className={`p-4 rounded-lg border-2 text-lg font-medium transition-all hover:brightness-110 disabled:cursor-not-allowed ${dimmed ? "opacity-50" : ""}`}
                      style={optionStyle(option, showFeedback)}
                      data-testid={`relay-duel-answer-${i}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {showFeedback && (
                <div
                  className="mt-4 text-center text-sm font-medium"
                  style={{ color: isCorrect ? colors.status.success.light : colors.status.danger.light }}
                  data-testid="relay-duel-feedback"
                >
                  {isCorrect
                    ? `¡Correcto! ${answererName} banks +${POINTS[assignedWord.difficulty]} pts.`
                    : `Not quite — the answer was "${assignedWord.answer}". No points.`}
                </div>
              )}
            </>
          )}

          {/* ---- DONE PHASE ---- */}
          {phase === "done" && (
            <div className="w-full max-w-md text-center">
              <div className="text-sm uppercase tracking-[0.25em] mb-2" style={mutedTextStyle}>
                Pool exhausted
              </div>
              <div className="text-3xl md:text-4xl font-bold mb-5">
                {winner === "tie" ? "It's a tie!" : `${PLAYER_NAMES[winner]} wins!`}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["p1", "p2"] as PlayerId[]).map((id) => (
                  <div
                    key={id}
                    className="rounded-xl border-2 p-4"
                    style={{
                      borderColor: winner === id ? colors.status.success.DEFAULT : colors.primary.dark,
                      backgroundColor: winner === id ? `${colors.status.success.DEFAULT}1A` : colors.background.elevated,
                    }}
                  >
                    <div className="text-sm" style={mutedTextStyle}>{PLAYER_NAMES[id]}</div>
                    <div className="text-3xl font-bold tabular-nums">{scores[id]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: phase-specific action */}
        <footer
          className="flex-shrink-0 flex flex-col items-center gap-2 w-full px-4 py-3 md:pb-4 border-t"
          style={subtleBorderStyle}
        >
          {phase === "pick" && (
            <button
              className={footerButtonClass}
              style={selectedWordId ? ctaEnabledStyle : ctaDisabledStyle}
              disabled={!selectedWordId}
              onClick={handleSend}
              data-testid="relay-duel-send"
            >
              Send to {answererName}
            </button>
          )}

          {phase === "handoff" && (
            <button
              className={footerButtonClass}
              style={ctaEnabledStyle}
              onClick={handleReady}
              data-testid="relay-duel-ready"
            >
              I&apos;m {answererName} — Ready
            </button>
          )}

          {phase === "answer" && (
            <button
              className={footerButtonClass}
              style={selectedAnswer ? ctaEnabledStyle : ctaDisabledStyle}
              disabled={!selectedAnswer}
              onClick={handleConfirm}
              data-testid="relay-duel-confirm"
            >
              Confirm Answer
            </button>
          )}

          {phase === "feedback" && (
            <button
              className={footerButtonClass}
              style={ctaEnabledStyle}
              onClick={handleContinue}
              data-testid="relay-duel-continue"
            >
              {remaining.length === 0 ? "See Results" : `Hand off to ${pickerName}`}
            </button>
          )}

          {phase === "done" && (
            <div className="flex w-full gap-2">
              <button
                className="flex-1 rounded-xl px-4 py-2.5 sm:py-3 font-bold text-base sm:text-lg border-2 transition-all active:scale-95 hover:brightness-110"
                style={{ borderColor: colors.primary.dark, backgroundColor: colors.background.elevated, color: colors.text.DEFAULT }}
                onClick={onBack}
                data-testid="relay-duel-back-home"
              >
                Back to Home
              </button>
              <button
                className={`flex-1 ${footerButtonClass}`}
                style={ctaEnabledStyle}
                onClick={handleRestart}
                data-testid="relay-duel-restart"
              >
                Play Again
              </button>
            </div>
          )}
        </footer>
      </div>
    </main>
  );
}
