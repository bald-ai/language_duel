import Link from "next/link";
import { ThemedPage } from "@/app/components/ThemedPage";
import { AuthButtons, LeftNavButtons } from "@/app/components/auth";

export default function MockOnlinePlaceholder() {
  return (
    <ThemedPage>
      <div className="absolute top-3 left-2 sm:left-4 z-20">
        <LeftNavButtons />
      </div>
      <div className="absolute top-3 right-2 sm:right-4 z-20">
        <AuthButtons />
      </div>

      <main className="relative z-10 flex flex-1 w-full items-start justify-center px-4 pt-20 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <section
          data-testid="mock-online-placeholder"
          className="w-full max-w-[480px] rounded-[28px] border p-5 shadow-2xl backdrop-blur-md animate-slide-up"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--color-background-elevated) 82%, white 18%) 0%, color-mix(in srgb, var(--color-background-elevated) 90%, transparent) 100%)",
            borderColor: "color-mix(in srgb, var(--color-primary) 22%, white 24%)",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
          }}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <Link
              href="/"
              data-testid="mock-online-back"
              className="rounded-full border px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] transition-colors"
              style={{
                color: "var(--color-text)",
                borderColor: "color-mix(in srgb, var(--color-primary) 40%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 65%, transparent)",
              }}
            >
              Back
            </Link>

            <div className="text-right">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: "var(--color-primary-dark)" }}
              >
                Prototype Shell
              </p>
              <h1 className="title-font text-3xl leading-none" style={{ color: "var(--color-text)" }}>
                Online Mock Features
              </h1>
            </div>
          </div>

          <p className="text-sm font-semibold leading-6" style={{ color: "var(--color-text)" }}>
            No online prototypes are active right now. This page is kept as a clean entry point for the next online mock.
          </p>
        </section>
      </main>
    </ThemedPage>
  );
}
