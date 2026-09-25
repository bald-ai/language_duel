"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";
import type { DuelMode } from "@/lib/duelMode";
import { isSelfDuelSelection } from "@/lib/challengeLobby/isSelfDuelSelection";
import { isSentenceTheme } from "@/lib/themes/themeContent";
import type { CreateChallengeOptions, LobbyUser } from "@/hooks/challengeLobby/types";
import type { ModalTheme } from "./types";

// One decision per screen. Steps appear/disappear with the choices so the user
// never sees an invalid option: Solo practice (self-duel) has no Mode step
// because PvE is forced; Mode only exists for a friend. Difficulty shows for any
// theme selection (it now scales sentence distractor count as well as the word
// difficulty mix), gated only on a theme being picked.
export type WizardStep = "opponent" | "theme" | "mode" | "difficulty" | "confirm";
type FlowDirection = "forward" | "back";
type FlowPhase = "idle" | "exit" | "enter";

const FLOW_EXIT_MS = 105;
const FLOW_ENTER_MS = 210;

function shouldAnimateFlow() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}


type WizardInput = {
  users: LobbyUser[] | undefined;
  viewer: LobbyUser | null | undefined;
  themes: ModalTheme[] | undefined;
  initialOpponentId?: Id<"users"> | null;
  onCreateChallenge: (options: CreateChallengeOptions) => void;
  isJoiningDuel: boolean;
  isCreatingChallenge: boolean;
};

export function useChallengeWizard({ users, viewer, themes, initialOpponentId, onCreateChallenge, isJoiningDuel, isCreatingChallenge }: WizardInput) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<Id<"users"> | null>(
    initialOpponentId ?? null
  );
  const [selectedThemeIds, setSelectedThemeIds] = useState<Id<"themes">[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DuelDifficultyPreset>("easy");
  // Intentionally unread when isSelfSelected; backend forces SELF_DUEL_FORCED_MODE.
  const [requestedMode, setRequestedMode] = useState<DuelMode>("pvp");
  const [stepKey, setStepKey] = useState<WizardStep>(initialOpponentId ? "theme" : "opponent");
  const [flowAnimation, setFlowAnimation] = useState<{
    phase: FlowPhase;
    direction: FlowDirection;
  }>({ phase: "idle", direction: "forward" });
  const transitionTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const isSelfSelected = isSelfDuelSelection(viewer, selectedOpponentId);
  const selectedOpponent = resolveOpponent(viewer, users, selectedOpponentId, isSelfSelected);

  // Relay now supports mixed word + sentence decks, so the mode is whatever the
  // user requested. Self-duels never expose Relay (handled by `isSelfSelected`).
  const selectedMode: DuelMode = requestedMode;
  const isRelaySelected = !isSelfSelected && selectedMode === "relay";
  const hasDifficultyStep = !isRelaySelected;

  const hasOpponent = selectedOpponentId != null;
  const hasTheme = selectedThemeIds.length > 0;

  // TbT ("Tag Team") shares one sentence tile board, so it is sentence-only.
  // Disable it in the picker unless EVERY selected theme is a sentence theme —
  // matching the server guard, which rejects a deck with any non-sentence theme.
  const disabledModes = getDisabledModes(themes, selectedThemeIds);
  const isSelectedModeDisabled = modeIsDisabled(isSelfSelected, disabledModes, selectedMode);

  const steps = getWizardSteps(hasOpponent, hasTheme, isSelfSelected, hasDifficultyStep);

  const activeStep: WizardStep = steps.includes(stepKey) ? stepKey : steps[steps.length - 1];
  const stepIndex = steps.indexOf(activeStep);
  const isFirst = stepIndex <= 0;
  const isConfirm = activeStep === "confirm";
  const isTransitioning = flowAnimation.phase !== "idle";
  const canCreate = hasOpponent && hasTheme && !isSelectedModeDisabled;

  const clearTransitionTimers = useCallback(() => {
    for (const timer of transitionTimersRef.current) {
      clearTimeout(timer);
    }
    transitionTimersRef.current = [];
  }, []);

  useEffect(() => clearTransitionTimers, [clearTransitionTimers]);

  const navigateToStep = (nextStep: WizardStep, direction: FlowDirection = "forward") => {
      if (nextStep === activeStep) return;
      clearTransitionTimers();
      if (!shouldAnimateFlow()) {
        setStepKey(nextStep);
        setFlowAnimation({ phase: "idle", direction });
        return;
      }
      setFlowAnimation({ phase: "exit", direction });
      const exitTimer = setTimeout(() => {
        setStepKey(nextStep);
        setFlowAnimation({ phase: "enter", direction });
        const enterTimer = setTimeout(() => {
          setFlowAnimation({ phase: "idle", direction });
          transitionTimersRef.current = [];
        }, FLOW_ENTER_MS);
        transitionTimersRef.current = [enterTimer];
      }, FLOW_EXIT_MS);
      transitionTimersRef.current = [exitTimer];
    };

  const handleSelectOpponent = (id: Id<"users">) => {
    if (isTransitioning) return;
    setSelectedOpponentId(id);
    navigateToStep("theme");
  };

  const handleSelectMode = (mode: DuelMode) => {
    if (isTransitioning || disabledModes?.[mode]) return;
    setRequestedMode(mode);
    navigateToStep(mode === "relay" ? "confirm" : "difficulty");
  };

  const handleSelectDifficulty = (preset: DuelDifficultyPreset) => {
    if (isTransitioning) return;
    setSelectedDifficulty(preset);
    navigateToStep("confirm");
  };

  const handleNext = () => {
    if (isTransitioning) return;
    const nextStep = getNextStep(activeStep, hasOpponent, isSelfSelected, isSelectedModeDisabled, isRelaySelected);
    if (nextStep) navigateToStep(nextStep);
  };

  const handleBack = () => {
    if (isTransitioning || stepIndex <= 0) return;
    navigateToStep(steps[stepIndex - 1], "back");
  };

  const handleThemeIdsChange = (themeIds: Id<"themes">[]) => {
    setSelectedThemeIds(themeIds);
    const nextAllSentenceThemes = hasOnlySentenceThemes(themes, themeIds);
    if (requestedMode === "tbt" && !nextAllSentenceThemes) {
      setRequestedMode("pvp");
    }
  };

  const handleCreateChallenge = () => {
    if (!selectedOpponentId || selectedThemeIds.length === 0 || isSelectedModeDisabled) return;
    onCreateChallenge({
      opponentId: selectedOpponentId,
      themeIds: selectedThemeIds,
      duelDifficultyPreset: isRelaySelected ? undefined : selectedDifficulty,
      duelMode: selectedMode,
    });
  };

  const flowClassName =
    flowAnimation.phase === "idle"
      ? ""
      : `duel-flow-${flowAnimation.phase}-${flowAnimation.direction}`;
  const primaryDisabled = isPrimaryDisabled(activeStep, isTransitioning, hasOpponent, hasTheme,
    isSelectedModeDisabled, canCreate, isCreatingChallenge, isJoiningDuel);
  const primaryLabel = getPrimaryLabel(isConfirm, isCreatingChallenge, isSelfSelected);

  return {
    selectedOpponentId, selectedOpponent, selectedThemeIds, selectedDifficulty, selectedMode,
    isSelfSelected, isRelaySelected, disabledModes, steps, activeStep, isFirst, isConfirm,
    isTransitioning, handleBack, handleSelectOpponent, handleThemeIdsChange, handleSelectMode,
    handleSelectDifficulty, handleCreateChallenge, handleNext, flowClassName, primaryDisabled, primaryLabel,
  };
}

function resolveOpponent(viewer: WizardInput["viewer"], users: WizardInput["users"], id: Id<"users"> | null, isSelf: boolean) {
  if (isSelf) return viewer ?? null;
  return users?.find(user => user._id === id) ?? null;
}

function hasOnlySentenceThemes(themes: WizardInput["themes"], ids: Id<"themes">[]): boolean {
  return ids.length > 0 && ids.every(id => themes?.some(theme => theme._id === id && isSentenceTheme(theme)));
}

function getDisabledModes(themes: WizardInput["themes"], ids: Id<"themes">[]): Partial<Record<DuelMode, string>> | undefined {
  return hasOnlySentenceThemes(themes, ids) ? undefined : { tbt: "Needs an all-sentence deck" };
}

function modeIsDisabled(isSelf: boolean, disabled: Partial<Record<DuelMode, string>> | undefined, mode: DuelMode): boolean {
  return !isSelf && Boolean(disabled?.[mode]);
}

function getNextStep(step: WizardStep, hasOpponent: boolean, isSelf: boolean, modeDisabled: boolean, isRelay: boolean): WizardStep | null {
  const next: Record<WizardStep, WizardStep | null> = {
    opponent: hasOpponent ? "theme" : null,
    theme: isSelf ? "difficulty" : "mode",
    mode: modeDisabled ? null : isRelay ? "confirm" : "difficulty",
    difficulty: "confirm",
    confirm: null,
  };
  return next[step];
}

function isPrimaryDisabled(step: WizardStep, transitioning: boolean, hasOpponent: boolean, hasTheme: boolean,
  modeDisabled: boolean, canCreate: boolean, creating: boolean, joining: boolean): boolean {
  const disabled: Record<WizardStep, boolean> = {
    opponent: !hasOpponent, theme: !hasTheme, mode: modeDisabled, difficulty: false,
    confirm: !canCreate || creating || joining,
  };
  return transitioning || disabled[step];
}

function getPrimaryLabel(confirm: boolean, creating: boolean, isSelf: boolean): string {
  if (!confirm) return "Continue";
  if (creating) return "Creating...";
  return isSelf ? "Start practice" : "Create Challenge";
}

function getWizardSteps(hasOpponent: boolean, hasTheme: boolean, isSelfSelected: boolean, hasDifficultyStep: boolean): WizardStep[] {
    const list: WizardStep[] = ["opponent"];
    if (!hasOpponent) return list;
    list.push("theme");
    if (!hasTheme) return list;
    if (!isSelfSelected) list.push("mode");
    if (hasDifficultyStep) list.push("difficulty");
    list.push("confirm");
    return list;
}
