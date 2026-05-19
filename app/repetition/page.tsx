"use client";

import { useRouter } from "next/navigation";
import { ThemedPage } from "@/app/components/ThemedPage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { RepetitionBoard } from "./components/RepetitionBoard";

export default function RepetitionPage() {
  const colors = useAppearanceColors();
  const router = useRouter();
  return (
    <ThemedPage className="px-4 py-6">
      <main className="relative z-10 mx-auto w-full max-w-[34rem] space-y-6">
        <header className="relative">
          <button
            onClick={() => router.push("/")}
            className="absolute left-0 top-0 p-2 rounded-lg border-2 transition-colors hover:opacity-80"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
            }}
            data-testid="repetition-back"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke={colors.text.muted}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="text-center">
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
