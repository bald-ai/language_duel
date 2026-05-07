"use client";

import { useRouter } from "next/navigation";
import { ThemedPage } from "@/app/components/ThemedPage";
import { BackButton } from "@/app/components/BackButton";
import { colors } from "@/lib/theme";
import { RepetitionBoard } from "./components/RepetitionBoard";

export default function WeeklyGoalRepetitionPage() {
  const router = useRouter();

  return (
    <ThemedPage className="px-4 py-6">
      <main className="relative z-10 mx-auto w-full max-w-[34rem] space-y-6">
        <header className="space-y-4">
          <BackButton
            onClick={() => router.push("/goals")}
            label="Back to Goals"
            dataTestId="sr-back-to-goals"
          />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: colors.text.muted }}>
              Weekly Goals
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-wide" style={{ color: colors.text.DEFAULT }}>
              Spaced Repetition
            </h1>
            <p className="mt-2 text-sm" style={{ color: colors.text.muted }}>
              Repeat completed goals when they become ready.
            </p>
          </div>
        </header>

        <RepetitionBoard />
      </main>
    </ThemedPage>
  );
}
