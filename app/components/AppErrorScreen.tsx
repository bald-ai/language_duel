"use client";

import { ThemedPage } from "@/app/components/ThemedPage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

interface AppErrorScreenProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function AppErrorScreen({ title, message, onRetry }: AppErrorScreenProps) {
  const colors = useAppearanceColors();

  const goHome = () => {
    window.location.href = "/";
  };

  return (
    <ThemedPage className="px-4 py-6">
      <main className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
        <section
          className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.status.danger.DEFAULT,
            boxShadow: `0 18px 45px ${colors.status.danger.DEFAULT}33`,
          }}
        >
          <h1 className="text-2xl font-black" style={{ color: colors.text.DEFAULT }}>
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: colors.text.muted }}>
            {message}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-xl border-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition hover:brightness-110"
                style={{
                  backgroundColor: colors.cta.DEFAULT,
                  borderColor: colors.cta.dark,
                  color: colors.text.inverse,
                }}
              >
                Try Again
              </button>
            ) : null}
            <button
              type="button"
              onClick={goHome}
              className="rounded-xl border-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition hover:brightness-110"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
            >
              Go Home
            </button>
          </div>
        </section>
      </main>
    </ThemedPage>
  );
}
