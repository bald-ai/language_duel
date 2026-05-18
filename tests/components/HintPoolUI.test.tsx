import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { HintPoolUI } from "@/app/duel/[duelId]/components/HintPoolUI";
import type { HintType } from "@/lib/hintPool/types";

describe("HintPoolUI", () => {
  it("fires an enabled hint button", () => {
    const onFireHint = vi.fn();
    render(
      <HintPoolUI
        usedHints={[]}
        usedCount={0}
        totalCount={4}
        currentQuestionHintFired={false}
        onFireHint={onFireHint}
      />
    );

    fireEvent.click(screen.getByTestId("duel-hint-fifty-fifty"));

    expect(onFireHint).toHaveBeenCalledWith("fifty_fifty");
  });

  it("labels the time hint with its full effective bonus", () => {
    render(
      <HintPoolUI
        usedHints={[]}
        usedCount={0}
        totalCount={4}
        currentQuestionHintFired={false}
        onFireHint={vi.fn()}
      />
    );

    expect(screen.getByTitle("+15 Seconds")).toBeInTheDocument();
  });

  it("greys out used hints and blocks all hints after one fires this question", () => {
    const onFireHint = vi.fn();
    render(
      <HintPoolUI
        usedHints={["fifty_fifty"]}
        usedCount={1}
        totalCount={4}
        currentQuestionHintFired
        onFireHint={onFireHint}
      />
    );

    expect(screen.getByTestId("duel-hint-fifty-fifty")).toBeDisabled();
    expect(screen.getByTestId("duel-hint-plus-ten")).toBeDisabled();
    fireEvent.click(screen.getByTestId("duel-hint-plus-ten"));
    expect(onFireHint).not.toHaveBeenCalled();
  });

  it("keeps two rendered clients in sync from the same shared pool state", () => {
    function TwoClientPool() {
      const [usedHints, setUsedHints] = useState<HintType[]>([]);
      const [currentQuestionHintFired, setCurrentQuestionHintFired] = useState(false);
      const fireHint = (hintType: HintType) => {
        setUsedHints((current) => [...current, hintType]);
        setCurrentQuestionHintFired(true);
      };

      return (
        <>
          <HintPoolUI
            usedHints={usedHints}
            usedCount={usedHints.length}
            totalCount={4}
            currentQuestionHintFired={currentQuestionHintFired}
            onFireHint={fireHint}
          />
          <HintPoolUI
            usedHints={usedHints}
            usedCount={usedHints.length}
            totalCount={4}
            currentQuestionHintFired={currentQuestionHintFired}
            onFireHint={fireHint}
          />
        </>
      );
    }

    render(<TwoClientPool />);

    expect(screen.getAllByText("0/4")).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId("duel-hint-fifty-fifty")[0]);

    expect(screen.getAllByText("1/4")).toHaveLength(2);
    expect(screen.getAllByTestId("duel-hint-fifty-fifty")[0]).toBeDisabled();
    expect(screen.getAllByTestId("duel-hint-fifty-fifty")[1]).toBeDisabled();
    expect(screen.getAllByTestId("duel-hint-anagram")[0]).toBeDisabled();
    expect(screen.getAllByTestId("duel-hint-anagram")[1]).toBeDisabled();
  });
});
