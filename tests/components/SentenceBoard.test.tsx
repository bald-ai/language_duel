import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { SentenceBoard } from "@/app/duel/[duelId]/components/SentenceBoard";
import { SENTENCE_TIMER_SECONDS } from "@/lib/themes/sentenceConstants";
const state = vi.hoisted(() => ({ mutations: new Map<string, ReturnType<typeof vi.fn>>(), error: vi.fn(), play: vi.fn(), playing: false }));
vi.mock("convex/react", () => ({ useMutation: (ref: Parameters<typeof getFunctionName>[0]) => state.mutations.get(getFunctionName(ref)) }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("@/hooks/useTTS", () => ({ useTTS: () => ({ isPlaying: state.playing, playTTS: state.play }) }));
const names = ["gameplay:answerSentenceRound", "gameplay:tapSentenceTile", "gameplay:removeLastSentenceTile", "gameplay:clearSentenceBoard", "gameplay:confirmSentenceRound", "sabotage:sendSabotage", "hintPool:fireSentenceHint"];
const mutation = (name: string) => state.mutations.get(name)!;
const sessionItem = { kind: "sentence" as const, englishPrompt: "I want coffee", tilePool: ["Quiero", "cafe", "pan"], themeId: "theme_1" as Id<"themes">, themeName: "Cafe", spanishSentence: "Quiero cafe", wordMeanings: ["I want", "coffee"], freeWordPositions: [], distractors: ["pan"], ttsStorageId: "audio_1" as Id<"_storage"> };
const question = { kind: "sentence" as const, englishPrompt: "I want coffee", tilePool: sessionItem.tilePool, answerRevealedToViewer: false };
function progress(placedTileIndices: number[], completed = false): NonNullable<Doc<"duels">["sentenceProgress"]> {
  return [{ questionIndex: 0, role: "challenger", placedTileIndices, completed, mistakes: 0, finalized: false, failedConfirms: 0 }];
}
function duel(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  return { _id: "duel_1" as Id<"duels">, _creationTime: 1, challengerId: "user_1" as Id<"users">, opponentId: "user_2" as Id<"users">, themeIds: [sessionItem.themeId], sessionItems: [sessionItem], itemOrder: [0], sourceType: "normal", duelMode: "pve", status: "active", currentItemIndex: 0, challengerAnswered: false, opponentAnswered: false, challengerScore: 0, opponentScore: 0, createdAt: 1, hintPoolUsed: [], sentenceHintPoolUsed: [], currentQuestionHintFired: false, questionStartTime: 10_000, ...overrides } as Doc<"duels">;
}
function board(value: Doc<"duels">, other: Partial<Parameters<typeof SentenceBoard>[0]> = {}) {
  return <SentenceBoard duel={value} sessionItem={sessionItem} question={question} viewerRole="challenger" {...other} />;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(10_000); state.mutations.clear(); state.error.mockReset(); state.play.mockReset(); state.playing = false;
  for (const name of names) state.mutations.set(name, vi.fn().mockResolvedValue(undefined));
  mutation("gameplay:confirmSentenceRound").mockResolvedValue({ correctnessMask: [true, false] });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("sentence board server actions", () => {
  it("places unplaced tiles, peels only the last placed tile and ignores eliminated tiles", async () => {
    render(board(duel({ sentenceProgress: progress([0, 1]), currentQuestionEliminatedTileIndices: [2] })));
    await act(async () => {
      fireEvent.click(screen.getByTestId("sentence-tile-0"));
      fireEvent.click(screen.getByTestId("sentence-tile-1"));
      fireEvent.click(screen.getByTestId("sentence-tile-2"));
    });
    expect(mutation("gameplay:tapSentenceTile")).not.toHaveBeenCalled();
    expect(mutation("gameplay:removeLastSentenceTile")).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", questionIndex: 0 });
  });
  it("places a new tile and reports failed edits", async () => {
    render(board(duel()));
    await act(async () => fireEvent.click(screen.getByTestId("sentence-tile-0")));
    expect(mutation("gameplay:tapSentenceTile")).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", questionIndex: 0, tileIndex: 0 });
    mutation("gameplay:tapSentenceTile").mockRejectedValue(new Error("Tile rejected"));
    await act(async () => fireEvent.click(screen.getByTestId("sentence-tile-1")));
    expect(state.error).toHaveBeenCalledWith("Tile rejected");
  });
  it("requires an edit between confirmations and resets the board on request", async () => {
    render(board(duel({ sentenceProgress: progress([0, 1]) })));
    await act(async () => fireEvent.click(screen.getByTestId("sentence-confirm")));
    expect(mutation("gameplay:confirmSentenceRound")).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", questionIndex: 0 });
    expect((screen.getByTestId("sentence-confirm") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => fireEvent.click(screen.getByTestId("sentence-tile-1")));
    expect((screen.getByTestId("sentence-confirm") as HTMLButtonElement).disabled).toBe(false);
    await act(async () => fireEvent.click(screen.getByTestId("sentence-reset")));
    expect(mutation("gameplay:clearSentenceBoard")).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", questionIndex: 0 });
  });
  it.each([
    ["gameplay:removeLastSentenceTile", "sentence-tile-0"],
    ["gameplay:clearSentenceBoard", "sentence-reset"],
    ["gameplay:confirmSentenceRound", "sentence-confirm"],
  ])("reports %s failures and keeps actions available", async (name, testId) => {
    mutation(name).mockRejectedValue(new Error("Write failed"));
    render(board(duel({ sentenceProgress: progress([0]) })));
    await act(async () => fireEvent.click(screen.getByTestId(testId)));
    expect(state.error).toHaveBeenCalledWith("Write failed");
    expect((screen.getByTestId("sentence-confirm") as HTMLButtonElement).disabled).toBe(false);
  });
  it("submits a completed sentence once and locks its controls", async () => {
    const value = duel({ sentenceProgress: progress([0, 1], true) });
    const view = render(board(value)); await act(async () => {});
    expect(mutation("gameplay:answerSentenceRound")).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", questionIndex: 0, timedOut: false });
    view.rerender(board({ ...value }));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(mutation("gameplay:answerSentenceRound")).toHaveBeenCalledOnce();
    expect(screen.getByTestId("sentence-completed")).toBeInTheDocument();
    expect((screen.getByTestId("sentence-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("sentence-hint-freeze-time")).toBeNull();
  });
  it("honors bonus time and submits only once at the timeout boundary", async () => {
    const bonus = 30;
    render(board(duel({ currentQuestionTimerBonusSeconds: bonus })));
    await act(async () => vi.advanceTimersByTime((SENTENCE_TIMER_SECONDS + bonus) * 1000 - 250));
    expect(mutation("gameplay:answerSentenceRound")).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(250));
    expect(mutation("gameplay:answerSentenceRound")).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", questionIndex: 0, timedOut: true });
    await act(async () => vi.advanceTimersByTime(1000));
    expect(mutation("gameplay:answerSentenceRound")).toHaveBeenCalledOnce();
  });
  it("shows a submission error when the server rejects timeout", async () => {
    mutation("gameplay:answerSentenceRound").mockRejectedValue(new Error("Submit failed"));
    render(board(duel()));
    await act(async () => vi.advanceTimersByTime(SENTENCE_TIMER_SECONDS * 1000));
    expect(state.error).toHaveBeenCalledExactlyOnceWith("Submit failed");
  });
  it("waits for the server question start before counting down", async () => {
    render(board(duel({ questionStartTime: undefined })));
    await act(async () => vi.advanceTimersByTime(120_000));
    expect(screen.getByTestId("sentence-timer").textContent).toContain(String(SENTENCE_TIMER_SECONDS));
    expect(mutation("gameplay:answerSentenceRound")).not.toHaveBeenCalled();
  });
  it("fires cooperative hints through the real hint hook", async () => {
    render(board(duel()));
    await act(async () => fireEvent.click(screen.getByTestId("sentence-hint-freeze-time")));
    expect(mutation("hintPool:fireSentenceHint")).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", hintType: "freeze_time" });
  });
  it("sends PvP sabotage and reports server rejection", async () => {
    render(board(duel({ duelMode: "pvp" })));
    expect(screen.queryByTestId("sentence-hint-freeze-time")).toBeNull();
    await act(async () => fireEvent.click(screen.getByTestId("sentence-sabotage-sticky")));
    expect(mutation("sabotage:sendSabotage")).toHaveBeenCalledExactlyOnceWith({ duelId: "duel_1", effect: "sticky" });
    mutation("sabotage:sendSabotage").mockRejectedValue(new Error("Sabotage unavailable"));
    await act(async () => fireEvent.click(screen.getByTestId("sentence-sabotage-bounce")));
    expect(state.error).toHaveBeenCalledWith("Sabotage unavailable");
  });
  it("plays stored sentence audio only after disclosure and disables replay while playing", async () => {
    const view = render(board(duel()));
    expect(screen.queryByTestId("sentence-listen")).toBeNull();
    const revealed = { ...question, answerRevealedToViewer: true, spanishSentence: "Quiero cafe" };
    view.rerender(board(duel(), { question: revealed }));
    expect(screen.getByTestId("sentence-feedback")).toHaveTextContent("Correct: Quiero cafe");
    await act(async () => fireEvent.click(screen.getByTestId("sentence-listen")));
    expect(state.play).toHaveBeenCalledExactlyOnceWith("duel-sentence-duel_1-0", "Quiero cafe", { storageId: "audio_1", themeId: "theme_1" });
    state.playing = true; view.rerender(board(duel(), { question: revealed }));
    expect(screen.getByTestId("sentence-listen")).toBeDisabled();
    expect(screen.getByTestId("sentence-listen")).toHaveTextContent("Playing...");
  });
});
