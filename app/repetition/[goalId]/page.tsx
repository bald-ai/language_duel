"use client";
import { ThemedPage } from "@/app/components/ThemedPage";
import { BackButton } from "@/app/components/BackButton";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser } from "@/lib/userDisplay";
import {
  getSpacedRepetitionIntervalDaysForStep,
  SPACED_REPETITION_TOTAL_STEPS,
} from "@/lib/spacedRepetition";
import { RepetitionProgress } from "../components/RepetitionProgress";
import { boardItemTitle, currentStepOf } from "../components/boardItemDisplay";
import { LIMITED_LIVES_DUEL_MODES } from "@/lib/duelMode";
import { DuelModePicker } from "@/app/components/modals/DuelModePicker";
import { useRepetitionLaunch } from "../hooks/useRepetitionLaunch";
type RepetitionLaunchModel = ReturnType<typeof useRepetitionLaunch>;
type RepetitionLaunchContentProps = RepetitionLaunchModel & {
  preview: NonNullable<RepetitionLaunchModel["preview"]>;
};

export default function RepetitionLaunchPage() {
  const colors = useAppearanceColors();
  const model = useRepetitionLaunch();
  const { preview, goBack } = model;
  if (preview === undefined) {
    return (
      <ThemedPage className="px-4 py-6">
        <main className="relative z-10 mx-auto flex min-h-[60vh] w-full max-w-[32rem] items-center justify-center">
          <p style={{ color: colors.text.muted }}>Loading launch...</p>
        </main>
      </ThemedPage>
    );
  }

  if (preview === null) {
    return (
      <ThemedPage className="px-4 py-6">
        <main className="relative z-10 mx-auto w-full max-w-[32rem] space-y-5">
          <BackButton onClick={goBack} label="Back" />
          <div
            className="rounded-2xl border-2 p-6 text-center"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.status.danger.DEFAULT,
              color: colors.text.DEFAULT,
            }}
          >
            This spaced repetition item is not available.
          </div>
        </main>
      </ThemedPage>
    );
  }

  return <RepetitionLaunchContent {...model} preview={preview} />;
}
function RepetitionLaunchContent(model: RepetitionLaunchContentProps) {
  const colors = useAppearanceColors();
  const { preview, goBack } = model;
  const currentStep = currentStepOf(preview);
  const intervalDays = getSpacedRepetitionIntervalDaysForStep(currentStep);
  const canStart = preview.canStart;
  const itemCountLabel = canStart ? preview.itemCount : "-";
  const title = boardItemTitle(preview);

  return (
    <ThemedPage className="px-4 py-6">
      <main className="relative z-10 mx-auto w-full max-w-[32rem] space-y-5">
        <BackButton
          onClick={goBack}
          label="Back to Board"
          dataTestId="sr-launch-back"
        />

        <section
          className="rounded-2xl border-2 p-5 space-y-5"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: canStart
              ? colors.cta.DEFAULT
              : colors.status.warning.DEFAULT,
            boxShadow: `0 16px 38px ${colors.primary.glow}`,
          }}
        >
          <div>
            <p
              className="text-xs font-black uppercase tracking-[0.24em]"
              style={{ color: colors.text.muted }}
            >
              Spaced Repetition {currentStep}/{preview.totalSteps}
            </p>
            <h1
              className="mt-2 text-2xl font-black"
              style={{ color: colors.text.DEFAULT }}
            >
              {title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
              {formatVisibleUser(preview.partner, "Deleted participant")} ·{" "}
              {intervalDays}-day mark
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
              }}
            >
              <p
                className="text-[10px] uppercase tracking-wide"
                style={{ color: colors.text.muted }}
              >
                Themes
              </p>
              <p
                className="text-xl font-black"
                style={{ color: colors.text.DEFAULT }}
              >
                {preview.themeCount}
              </p>
            </div>
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
              }}
            >
              <p
                className="text-[10px] uppercase tracking-wide"
                style={{ color: colors.text.muted }}
              >
                Items
              </p>
              <p
                className="text-xl font-black"
                style={{ color: colors.text.DEFAULT }}
              >
                {itemCountLabel}
              </p>
            </div>
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
              }}
            >
              <p
                className="text-[10px] uppercase tracking-wide"
                style={{ color: colors.text.muted }}
              >
                Lives
              </p>
              <p
                className="text-xl font-black"
                style={{ color: colors.text.DEFAULT }}
              >
                {preview.livesTotal}
              </p>
            </div>
          </div>

          <RepetitionProgress
            completedCount={preview.completedSteps.length}
            currentStep={currentStep}
            showLabels
          />

          <RepetitionAvailability preview={preview} />

          <RepetitionLaunchActions {...model} />
        </section>
      </main>
    </ThemedPage>
  );
}
function RepetitionAvailability({
  preview,
}: Pick<RepetitionLaunchContentProps, "preview">) {
  const colors = useAppearanceColors();
  return (
    <>
      {!preview.contentAvailable && (
        <p
          className="rounded-xl border p-3 text-sm"
          style={{
            borderColor: colors.status.warning.DEFAULT,
            color: colors.text.DEFAULT,
          }}
        >
          {preview.unavailableReason}
        </p>
      )}
      {preview.bucket === "coming_up" && (
        <p
          className="rounded-xl border p-3 text-sm"
          style={{
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
        >
          This repetition unlocks in {preview.daysRemaining} day
          {preview.daysRemaining === 1 ? "" : "s"}.
        </p>
      )}
      {preview.bucket === "done" && (
        <p
          className="rounded-xl border p-3 text-sm"
          style={{
            borderColor: colors.cta.DEFAULT,
            color: colors.text.DEFAULT,
          }}
        >
          This goal is {SPACED_REPETITION_TOTAL_STEPS}/
          {SPACED_REPETITION_TOTAL_STEPS} complete.
        </p>
      )}
    </>
  );
}
function RepetitionLaunchActions({
  preview,
  selectedMode,
  setSelectedMode,
  isStarting,
  handleStartDuel,
  handleStartSolo,
}: RepetitionLaunchContentProps) {
  const colors = useAppearanceColors();
  const duelAvailable = preview.duelAvailable;
  const isDisabled = !preview.canStart || isStarting !== null;
  return (
    <>
      {duelAvailable && (
        <DuelModePicker
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          dataTestIdPrefix="repetition-mode"
          allowedModes={LIMITED_LIVES_DUEL_MODES}
          layout="rows"
        />
      )}
      <div
        className={`grid gap-2 ${duelAvailable ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {duelAvailable && (
          <button
            type="button"
            onClick={handleStartDuel}
            disabled={isDisabled}
            className="rounded-xl border-2 px-3 py-3 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: colors.cta.DEFAULT,
              borderColor: colors.cta.dark,
              color: colors.text.inverse,
            }}
            data-testid="sr-launch-start-duel"
          >
            {isStarting === "duel" ? "Starting..." : "Start Duel"}
          </button>
        )}
        <button
          type="button"
          onClick={handleStartSolo}
          disabled={isDisabled}
          className="rounded-xl border-2 px-3 py-3 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          data-testid="sr-launch-start-solo"
        >
          {isStarting === "solo" ? "Starting..." : "Solo"}
        </button>
      </div>
      {!duelAvailable && (
        <p className="text-xs" style={{ color: colors.text.muted }}>
          This partner is no longer available. Solo practice is still available.
        </p>
      )}
    </>
  );
}
