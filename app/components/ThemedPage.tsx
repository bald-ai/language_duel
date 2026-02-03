"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
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
  const scrollLayerRef = useRef<HTMLDivElement | null>(null);
  const isScrollingRef = useRef(false);

  // Get user's selected background from context
  const backgroundContext = useBackground();

  // Use prop if provided, otherwise use user's preference from context
  const effectiveBackground = backgroundImage ?? `/${backgroundContext.background}`;

  const rootClassName = useMemo(
    () => ["min-h-dvh flex flex-col relative", className].filter(Boolean).join(" "),
    [className]
  );

  useEffect(() => {
    const scrollLayer = scrollLayerRef.current;
    if (!scrollLayer) {
      return;
    }

    let timeoutId: number | null = null;
    let rafId: number | null = null;

    const setWillChange = (value: "auto" | "transform") => {
      if (scrollLayer.style.willChange !== value) {
        scrollLayer.style.willChange = value;
      }
    };

    const scheduleWillChange = (value: "auto" | "transform") => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        setWillChange(value);
        rafId = null;
      });
    };

    const handleScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        scheduleWillChange("transform");
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        isScrollingRef.current = false;
        scheduleWillChange("auto");
      }, 160);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className={rootClassName}>
      {/* 
        Background container - Fixed viewport wrapper to prevent mobile browser 
        resize jank when scrolling (Android Chrome URL bar, iOS Safari)
      */}
      <div
        ref={scrollLayerRef}
        className="fixed -z-10 overflow-hidden"
        style={{
          // Force GPU compositing layer - critical for Android scroll performance
          transform: "translateZ(0)",
          willChange: "auto",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          // Use large viewport height - doesn't change when browser chrome hides/shows
          height: "100lvh",
          width: "100vw",
          top: 0,
          left: 0,
        }}
      >
        {/* Background image layer */}
        {/* 
          Eager loading required: Background images were not loading at all on smaller screens
          without this. The lazy loading behavior was causing display issues on mobile.
          Trade-off: Slightly higher initial load, but ensures background always displays.
        */}
        {effectiveBackground && (
          <Image
            src={effectiveBackground}
            alt="Background"
            fill
            loading="eager"
            className="object-cover"
            style={{
              objectPosition: backgroundFocalPoint,
              // Prevent image from causing repaints during scroll
              transform: "translateZ(0)",
            }}
            sizes="100vw"
          />
        )}
      </div>

      {children}
    </div>
  );
}
