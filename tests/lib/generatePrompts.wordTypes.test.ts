import { describe, expect, it } from "vitest";
import {
  buildFieldSystemPrompt,
  buildGenerateMoreWordsUserMessage,
  buildGenerateThemeUserMessage,
  buildGenerateMoreWordsPrompt,
  buildRegenerateForWordPrompt,
  buildThemeSystemPrompt,
} from "@/lib/generate/prompts";

describe("generate prompt word type rules", () => {
  it("requires definite articles for noun themes", () => {
    const prompt = buildThemeSystemPrompt("Kitchen", 5, undefined, "nouns");

    expect(prompt).toContain("ANSWER AND MULTIPLE CHOICES MUST CONTAIN DEFINITE ARTICLE");
    expect(prompt).toContain("English noun");
    expect(prompt).not.toContain("Spanish INFINITIVE");
  });

  it("requires infinitive verbs without articles and limits Irr markers to correct answers", () => {
    const prompt = buildThemeSystemPrompt("Movement", 5, undefined, "verbs");

    expect(prompt).toContain("Spanish INFINITIVE form");
    expect(prompt).toContain("NO articles (el/la)");
    expect(prompt).toContain('end the Spanish infinitive with "(Irr)"');
    expect(prompt).toContain('Wrong answers must NOT include the "(Irr)" or "*" markers');
  });

  it("requires masculine singular/base-form adjectives without articles or Irr markers", () => {
    const prompt = buildThemeSystemPrompt("Feelings", 5, undefined, "adjectives");

    expect(prompt).toContain(
      "Generate English adjectives with Spanish adjective translations in masculine singular/base form."
    );
    expect(prompt).toContain("masculine singular/base form");
    expect(prompt).toContain("NO articles (el/la)");
    expect(prompt).toContain("NO plural forms");
    expect(prompt).toContain("NO feminine forms unless the base form is naturally invariant");
    expect(prompt).toContain('NO "(Irr)" marker');
    expect(prompt).toContain('"rojo", "cansado", "interesante", "feliz"');
    expect(prompt).toContain("Wrong answers should also be Spanish adjectives");
  });

  it("requires canonical adverbs with -mente preference and bare-adjective distractor limit", () => {
    const prompt = buildThemeSystemPrompt("Daily Routine", 5, undefined, "adverbs");

    expect(prompt).toContain("Generate English adverbs with their Spanish adverb translations.");
    expect(prompt).toContain("prefer the -mente form");
    expect(prompt).toContain('"bien", "mal", "siempre", "aquí", "muy"');
    expect(prompt).toContain("NO articles (el/la)");
    expect(prompt).toContain('NO "(Irr)" marker');
    expect(prompt).toContain("AT MOST ONE bare-adjective form");
  });

  it("uses noun article rules when regenerating a noun answer", () => {
    const prompt = buildRegenerateForWordPrompt("Kitchen", "spoon", "nouns");

    expect(prompt).toContain("DEFINITE ARTICLE");
    expect(prompt).toContain("Correct Spanish translation");
    expect(prompt).not.toContain("Spanish infinitive");
  });

  it("keeps verb wrong-answer regeneration marker-free", () => {
    const prompt = buildFieldSystemPrompt(
      "wrong",
      "Movement",
      "go",
      "ir(Irr)",
      ["venir", "andar", "correr"],
      0,
      undefined,
      undefined,
      "verbs"
    );

    expect(prompt).toContain("Must be a Spanish infinitive");
    expect(prompt).toContain('Must NOT include the "(Irr)" or "*" markers');
    expect(prompt).toContain('different from the correct answer "ir(Irr)"');
  });

  it("keeps adverb regeneration prompts aligned with -mente preference and distractor limit", () => {
    const wrongPrompt = buildFieldSystemPrompt(
      "wrong",
      "Daily Routine",
      "quickly",
      "rápidamente",
      ["lentamente", "frecuentemente", "siempre"],
      0,
      undefined,
      undefined,
      "adverbs"
    );
    const regeneratePrompt = buildRegenerateForWordPrompt("Daily Routine", "quickly", "adverbs");

    expect(regeneratePrompt).toContain("prefer the -mente form");
    expect(wrongPrompt).toContain(
      "bare-adjective form is allowed only if no other kept wrong answer is already a bare-adjective form"
    );
  });

  it("uses the same word-type wording for generate-more word generation", () => {
    const prompt = buildGenerateMoreWordsPrompt("Movement", 3, ["go"], "verbs");

    expect(prompt).toContain("NEW English verbs");
    expect(prompt).toContain("Spanish infinitive translations");
  });

  it("uses adjective wording for generate-more word generation", () => {
    const prompt = buildGenerateMoreWordsPrompt("Personality", 3, ["kind"], "adjectives");

    expect(prompt).toContain("NEW English adjectives");
    expect(prompt).toContain("Spanish adjective translations in masculine singular/base form");
    expect(prompt).toContain("NO articles (el/la)");
    expect(prompt).toContain('NO "(Irr)" marker');
  });

  it("uses English word-type wording in adjective user messages", () => {
    expect(buildGenerateThemeUserMessage("Personality", 3, "adjectives")).toBe(
      'Generate 3 English adjectives for the theme "Personality".'
    );
    expect(buildGenerateMoreWordsUserMessage("Personality", 2, "adjectives")).toBe(
      'Generate 2 new English adjectives for the theme "Personality".'
    );
  });

  it("uses English word-type wording in adverb user messages", () => {
    expect(buildGenerateThemeUserMessage("Daily Routine", 3, "adverbs")).toBe(
      'Generate 3 English adverbs for the theme "Daily Routine".'
    );
    expect(buildGenerateMoreWordsUserMessage("Daily Routine", 2, "adverbs")).toBe(
      'Generate 2 new English adverbs for the theme "Daily Routine".'
    );
  });
});
