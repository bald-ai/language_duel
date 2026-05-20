"use client";

import { ReactNode, useMemo } from "react";
import { useBackground } from "./BackgroundProvider";

interface ThemedPageProps {
  children: ReactNode;
  className?: string;
  backgroundImage?: string;
  backgroundFocalPoint?: string;
}

export function ThemedPage({
  children,
  className,
  backgroundImage,
  backgroundFocalPoint = "50% 30%"
}: ThemedPageProps) {
  // Get user's selected background from context
  const backgroundContext = useBackground();

  // Use prop if provided, otherwise use user's preference from context
  const effectiveBackground = backgroundImage ?? `/${backgroundContext.background}`;

  const rootClassName = useMemo(
    () => ["min-h-dvh flex flex-col relative", className].filter(Boolean).join(" "),
    [className]
  );

  return (
    <div className={rootClassName}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
        }}
      >
        {effectiveBackground && (
          <img
            src={effectiveBackground}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: backgroundFocalPoint,
            }}
          />
        )}
      </div>

      {children}
    </div>
  );
}
