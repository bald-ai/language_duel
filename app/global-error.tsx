"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global app error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          className="flex min-h-dvh items-center justify-center px-4 py-6"
          style={{
            backgroundColor: "var(--color-background)",
            color: "var(--color-text)",
          }}
        >
          <section
            className="w-full max-w-md rounded-3xl border-2 p-6 text-center"
            style={{
              backgroundColor: "var(--color-background-elevated)",
              borderColor: "var(--color-danger)",
              boxShadow: "0 18px 45px color-mix(in srgb, var(--color-danger) 20%, transparent)",
            }}
          >
            <h1 className="text-2xl font-black">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--color-text-muted)" }}>
              The app had a problem loading. Try again, or go back home and start from there.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border-2 px-4 py-3 text-sm font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: "var(--color-cta)",
                  borderColor: "var(--color-cta-dark)",
                  color: "var(--color-text)",
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="rounded-xl border-2 px-4 py-3 text-sm font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: "var(--color-background)",
                  borderColor: "var(--color-primary-dark)",
                  color: "var(--color-text)",
                }}
              >
                Go Home
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
