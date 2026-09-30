import type { Doc } from "../../convex/_generated/dataModel";

type RelayStateFields = Pick<Doc<"duels">,
  "relayPhase" | "relayPicker" | "relayResolvedIndices" | "relayHardUpgradeIndices" | "relayHardBudget"
>;
export type RelayState = Required<RelayStateFields>;

export function requireRelayValue<T>(value: T | undefined, field: string): T {
  if (value === undefined) throw new Error(`Relay duel is missing ${field}`);
  return value;
}

/** Relay fields are absent on other modes, but mandatory once relay is selected. */
export function requireRelayState<T extends RelayStateFields>(duel: T): T & RelayState {
  requireRelayValue(duel.relayPhase, "relayPhase");
  requireRelayValue(duel.relayPicker, "relayPicker");
  requireRelayValue(duel.relayResolvedIndices, "relayResolvedIndices");
  requireRelayValue(duel.relayHardUpgradeIndices, "relayHardUpgradeIndices");
  requireRelayValue(duel.relayHardBudget, "relayHardBudget");
  return duel as T & RelayState;
}
