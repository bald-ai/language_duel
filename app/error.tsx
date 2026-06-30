"use client";

import { useEffect } from "react";
import { AppErrorScreen } from "@/app/components/AppErrorScreen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <AppErrorScreen
      title="Something went wrong"
      message="The page had a problem. Try again, or go back home and start from there."
      onRetry={reset}
    />
  );
}
