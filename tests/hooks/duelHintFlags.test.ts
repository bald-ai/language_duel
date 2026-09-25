import { describe, expect, it } from "vitest";
import { deriveHintFlags } from "@/app/duel/[duelId]/hooks/duelViewModelHelpers";
import { PVP_HINT_ELIMINATION_PICKS } from "@/lib/hintPool/constants";
const base = { isPve: false, hasAnswered: false, opponentHasAnswered: false, hintRequestedBy: undefined as string | undefined, hintAccepted: undefined as boolean | undefined, eliminatedOptions: [] as string[], myRole: "challenger" as const, theirRole: "opponent" as const };
const unavailable = { canRequestHint: false, iRequestedHint: false, theyRequestedHint: false, hintAccepted: false, canAcceptHint: false, isHintProvider: false, canEliminate: false };
describe("viewer cooperative hint policy", () => {
  it("uses the PvE pool instead of peer request and elimination controls", () => {
    expect(deriveHintFlags({ ...base, isPve: true, hasAnswered: true, opponentHasAnswered: true, hintRequestedBy: "opponent", hintAccepted: true })).toEqual(unavailable);
  });
  it("permits requesting help only after the other player has answered", () => {
    expect(deriveHintFlags(base)).toEqual(unavailable);
    expect(deriveHintFlags({ ...base, opponentHasAnswered: true })).toEqual({ ...unavailable, canRequestHint: true });
    expect(deriveHintFlags({ ...base, opponentHasAnswered: true, hintRequestedBy: "challenger" })).toEqual({ ...unavailable, iRequestedHint: true });
    expect(deriveHintFlags({ ...base, hasAnswered: true, opponentHasAnswered: true })).toEqual(unavailable);
  });
  it("allows the answered player to accept their peer's request before eliminating options", () => {
    const request = { ...base, hasAnswered: true, hintRequestedBy: "opponent" };
    expect(deriveHintFlags(request)).toEqual({ ...unavailable, theyRequestedHint: true, canAcceptHint: true });
    expect(deriveHintFlags({ ...request, hintAccepted: true })).toEqual({ ...unavailable, theyRequestedHint: true, hintAccepted: true, isHintProvider: true, canEliminate: true });
    expect(deriveHintFlags({ ...request, hasAnswered: false })).toEqual({ ...unavailable, theyRequestedHint: true });
  });
  it("stops elimination exactly at the per-request allowance", () => {
    const accepted = { ...base, hasAnswered: true, hintRequestedBy: "opponent", hintAccepted: true };
    expect(deriveHintFlags({ ...accepted, eliminatedOptions: Array.from({ length: PVP_HINT_ELIMINATION_PICKS - 1 }, (_, i) => `option-${i}`) }).canEliminate).toBe(true);
    expect(deriveHintFlags({ ...accepted, eliminatedOptions: Array.from({ length: PVP_HINT_ELIMINATION_PICKS }, (_, i) => `option-${i}`) })).toEqual({ ...unavailable, theyRequestedHint: true, hintAccepted: true, isHintProvider: true });
  });
  it("interprets requests from the opponent viewer's perspective", () => {
    expect(deriveHintFlags({ ...base, myRole: "opponent", theirRole: "challenger", hasAnswered: true, hintRequestedBy: "challenger", hintAccepted: true })).toEqual({ ...unavailable, theyRequestedHint: true, hintAccepted: true, isHintProvider: true, canEliminate: true });
  });
});
