"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

type BackButtonProps = {
  /**
   * Optional explicit handler. If omitted, uses router.back() with "/" fallback.
   */
  onClick?: () => void;
  label?: string;
  dataTestId?: string;
  className?: string;
  fallbackHref?: string;
};

const baseClassName =
  "w-full bg-gradient-to-b border-t-2 border-b-3 border-x-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-md";

export function BackButton({
  onClick,
  label = "Back",
  dataTestId,
  className,
  fallbackHref = "/",
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }

    // "Back" should go to the previous page when possible.
    // If the user opened this page directly (no history), fall back to Home.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [fallbackHref, onClick, router]);

  return (
    <button
      onClick={handleClick}
      className={[baseClassName, className].filter(Boolean).join(" ")}
      style={{
        backgroundImage:
          "linear-gradient(to bottom, var(--color-primary), var(--color-primary-dark))",
        borderTopColor: "var(--color-primary-light)",
        borderBottomColor: "var(--color-primary-dark)",
        borderLeftColor: "var(--color-primary)",
        borderRightColor: "var(--color-primary)",
        color: "var(--color-text)",
        textShadow: "0 2px 4px rgba(0,0,0,0.4)",
      }}
      data-testid={dataTestId}
      type="button"
    >
      {label}
    </button>
  );
}
