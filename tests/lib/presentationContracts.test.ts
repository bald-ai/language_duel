import { describe, expect, it } from "vitest";
import { getWordTypeLabel } from "@/lib/themes/wordTypes";
import { formatBossTrophy } from "@/lib/limitedLives";
import { getTtsProviderLabel } from "@/lib/tts/providers";
import { buildSoloSearchParams } from "@/lib/soloNavigation";
import { getPlainBackendErrorMessage, normalizePlainErrorMessage } from "@/lib/userFacingErrors";
import { normalizeThemeName, normalizeThemeDescription, normalizeSaveRequestId } from "@/lib/themes/serverValidation";

describe("content labels and source navigation", () => {
  it("resolves word type labels, casing and optional defaults", () => {
    expect(getWordTypeLabel("verbs")).toBe("Verbs");
    expect(getWordTypeLabel("adverbs", { uppercase: true })).toBe("ADVERBS");
    expect(getWordTypeLabel(undefined, { fallback: "Mixed", uppercase: false })).toBe("Mixed");
    expect(getWordTypeLabel(undefined)).toBe("Nouns");
    expect(getWordTypeLabel(undefined, {})).toBe("Nouns");
    expect(getWordTypeLabel(undefined, { fallback: "" })).toBe("");
  });
  it.each([["gold", "Gold Trophy"], ["silver", "Silver Trophy"], ["bronze", "Bronze Trophy"]] as const)("labels %s trophies", (trophy, label) => expect(formatBossTrophy(trophy)).toBe(label));
  it("labels both supported audio providers", () => {
    expect(getTtsProviderLabel("resemble")).toBe("Resemble AI");
    expect(getTtsProviderLabel("elevenlabs")).toBe("ElevenLabs");
  });
  it.each([undefined, []])("omits unselected themes %j in ad-hoc and weekly practice", themeIds => {
    expect(buildSoloSearchParams({ themeIds }).toString()).toBe("");
    expect(buildSoloSearchParams({ weeklyGoalId: "g", themeIds }).toString()).toBe("weeklyGoalId=g");
  });
  it("serializes single and mixed ad-hoc themes without losing order", () => {
    expect(Object.fromEntries(buildSoloSearchParams({ themeIds: ["a"] }))).toEqual({ themeId: "a", themeIds: "a" });
    expect(Object.fromEntries(buildSoloSearchParams({ themeIds: ["b", "a"], durationSeconds: 0 }))).toEqual({ themeIds: "b,a", duration: "0" });
  });
});

describe("validation and backend error presentation", () => {
  it.each([
    ["AUTH_FAILED", undefined, "Please sign in and try again."],
    ["CONFIG_ERROR", undefined, "This feature is not set up correctly yet. Please try again later."],
    ["INTERNAL_ERROR", undefined, "Something went wrong on our side. Please try again."],
    ["INVALID_IDENTITY", undefined, "Your sign-in is missing required account details. Please sign out and sign in again."],
    ["CREDITS_EXHAUSTED", "tts exhausted", "You are out of audio credits."],
    ["CREDITS_EXHAUSTED", "generation exhausted", "You are out of AI generation credits."],
    ["CREDITS_EXHAUSTED", undefined, "You are out of credits for this action."],
    ["NOT_AUTHORIZED", "Not authorized", "You do not have permission to do that."],
    ["NOT_AUTHORIZED", undefined, "You do not have permission to do that."],
    ["NOT_AUTHORIZED", "Only the owner can edit", "Only the owner can edit"],
    ["NOT_FOUND", undefined, "We could not find that item. It may have been deleted."],
    ["NOT_FOUND", "Theme missing", "Theme missing"],
    ["UNKNOWN_ERROR", undefined, "Try later. Please try again."],
    ["unrecognized", undefined, null], ["toString", undefined, null],
  ])("presents %s / %s", (code, raw, expected) => expect(getPlainBackendErrorMessage(code!, raw ?? undefined, "Try later")).toBe(expected));
  it.each([
    [undefined, "Could not save. Please try again."], ["", "Could not save. Please try again."],
    ["LLM credits exhausted", "You are out of AI generation credits."], ["TTS credits exhausted", "You are out of audio credits."],
    ["Unauthorized", "Please sign in and try again."], ["Not authorized", "You do not have permission to do that."],
    ["Convex URL not configured", "This feature is not set up correctly yet. Please try again later."],
    ["Unexpected token x", "Could not save. Please try again."], ["  Theme unavailable  ", "Theme unavailable"],
  ])("normalizes existing plain message %s", (raw, expected) => expect(normalizePlainErrorMessage(raw, "Could not save")).toBe(expected));
  it("normalizes names and rejects short/long boundary fields", () => {
    expect(normalizeThemeName("  travel ")).toBe("TRAVEL");
    expect(normalizeThemeDescription("  A trip ")).toBe("A trip");
    expect(normalizeSaveRequestId("  request-1 ")).toBe("request-1");
    expect(() => normalizeThemeName("")).toThrow(/must be at least/);
    expect(() => normalizeThemeDescription("")).toThrow("Theme description must be at least 1 character");
    expect(() => normalizeThemeDescription("x".repeat(10000))).toThrow(/must be at most/);
  });
});
