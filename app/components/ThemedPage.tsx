"use client";

import { ReactNode, useMemo } from "react";
import { useBackground } from "./BackgroundProvider";

interface ThemedPageProps {
  children: ReactNode;
  className?: string;
  backgroundImage?: string;
  backgroundImageWide?: string;
  backgroundFocalPoint?: string;
}

export function ThemedPage({
  children,
  className,
  backgroundImage,
  backgroundImageWide,
  backgroundFocalPoint = "50% 30%"
}: ThemedPageProps) {
  // Get user's selected background from context
  const backgroundContext = useBackground();

  // Use prop if provided, otherwise use user's preference from context
  const effectiveBackground = backgroundImage ?? `/${backgroundContext.background}`;

  // Wide (16:9) variant shown on landscape viewports. Default: derive from the
  // portrait filename (background_2.jpg -> background_2-wide.jpg) so it stays in
  // sync with whichever background is selected; callers can override.
  const effectiveBackgroundWide =
    backgroundImageWide ?? effectiveBackground.replace(/\.jpg$/, "-wide.jpg");

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
          <picture style={{ display: "block", width: "100%", height: "100%" }}>
            {/* Landscape viewports get the 16:9 wide variant; portrait falls back to the <img>. */}
            <source media="(min-aspect-ratio: 1/1)" srcSet={effectiveBackgroundWide} />
            <img
              src={effectiveBackground}
              alt=""
              loading="eager"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: backgroundFocalPoint,
                transform: "translateZ(0)",
              }}
            />
          </picture>
        )}
      </div>

      {children}
    </div>
  );
}
