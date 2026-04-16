import { describe, expect, it } from "vitest";
import { collectThemeIssues, describeThemeValidationIssues } from "@/lib/themes/serverValidation";

const sixWrong = (prefix: string) =>
  Array.from({ length: 6 }, (_, j) => `${prefix}-wrong-${j}`);

describe("collectThemeIssues", () => {
  it("returns multiple distinct issues for the same payload", () => {
    const words = [
      {
        word: "cat",
        answer: "",
        wrongAnswers: sixWrong("a"),
      },
      {
        word: " CAT ",
        answer: "macka",
        wrongAnswers: sixWrong("b"),
      },
    ];

    const issues = collectThemeIssues(words);
    const messages = describeThemeValidationIssues(words);

    expect(issues.map((i) => i.type)).toEqual(
      expect.arrayContaining(["answer_empty", "duplicate_word"])
    );
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Word 1: answer must be at least 1 character"),
        expect.stringContaining("Words 1 and 2"),
        expect.stringContaining("duplicates after normalization"),
      ])
    );
  });

  it("does not report duplicate noise for empty words or empty wrong answers", () => {
    const words = [
      {
        word: "",
        answer: "la casa",
        wrongAnswers: ["", "", "uno", "dos", "tres", "cuatro"],
      },
      {
        word: " ",
        answer: "el perro",
        wrongAnswers: sixWrong("b"),
      },
    ];

    const issues = collectThemeIssues(words);
    const issueTypes = issues.map((issue) => issue.type);

    expect(issueTypes).toEqual(expect.arrayContaining(["word_empty", "wrong_answer_empty"]));
    expect(issueTypes).not.toContain("duplicate_word");
    expect(issueTypes).not.toContain("duplicate_wrong_answer");
  });
});
