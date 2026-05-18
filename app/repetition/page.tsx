"use client";

import { ThemedPage } from "@/app/components/ThemedPage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { RepetitionBoard } from "./components/RepetitionBoard";

export default function RepetitionPage() {
  const colors = useAppearanceColors();
  return (
    <ThemedPage className="px-4 py-6">
      <main className="relative z-10 mx-auto w-full max-w-[34rem] space-y-6">
        <header>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: colors.text.muted }}>
              Practice
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-wide" style={{ color: colors.text.DEFAULT }}>
              Spaced Repetition
            </h1>
            <p className="mt-2 text-sm" style={{ color: colors.text.muted }}>
              Review completed goals when they become ready.
            </p>
          </div>
        </header>

        <RepetitionBoard />
      </main>
    </ThemedPage>
  );
}
