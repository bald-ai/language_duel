/**
 * Duel module - Re-exports all duel-related mutations and queries:
 * - lobby.ts: Duel creation, acceptance, rejection, cancellation
 * - gameplay.ts: Answer submission, timer controls, countdown management
 * - hints.ts: Classic and solo-style hint systems
 * - sabotage.ts: Sabotage effects between players
 */

// Lobby operations
export {
  createDuel,
  getDuel,
  getPendingDuels,
  acceptDuel,
  rejectDuel,
  stopDuel,
  cancelPendingDuel,
} from "./lobby";

// Gameplay operations
export {
  answerDuel,
  timeoutAnswer,
  pauseCountdown,
  requestUnpauseCountdown,
  confirmUnpauseCountdown,
  skipCountdown,
  selectLearnTimer,
  confirmLearnTimer,
  initializeDuelChallenge,
  submitSoloAnswer,
} from "./gameplay";

// Hint operations
export {
  requestHint,
  acceptHint,
  eliminateOption,
  requestSoloHint,
  updateSoloHintState,
  acceptSoloHint,
  provideSoloHint,
  cancelSoloHint,
  requestSoloHintL2,
  acceptSoloHintL2,
  eliminateSoloHintL2Option,
  cancelSoloHintL2,
} from "./hints";

// Sabotage operations
export { sendSabotage } from "./sabotage";
