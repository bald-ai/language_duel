"use client";

import { ReactNode, useEffect, useState } from "react";
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
  const [isMobile, setIsMobile] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  
  // Get user's selected background from context
  const backgroundContext = useBackground();
  
  // Use prop if provided, otherwise use user's preference from context
  const effectiveBackground = backgroundImage ?? `/${backgroundContext.background}`;
  
  const rootClassName = [
    "min-h-dvh flex flex-col relative",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);

    return () => {
      window.removeEventListener("resize", updateIsMobile);
    };
  }, []);

  useEffect(() => {
    let timeoutId: number | null = null;

    const handleScroll = () => {
      setIsScrolling(true);

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        setIsScrolling(false);
      }, 160);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
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
        className="fixed -z-10 overflow-hidden"
        style={{ 
          // Force GPU compositing layer - critical for Android scroll performance
          transform: "translateZ(0)",
          willChange: isScrolling ? "transform" : "auto",
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
        {effectiveBackground && (
          <Image
            src={effectiveBackground}
            alt="Background"
            fill
            priority={!isMobile}
            loading={isMobile ? "lazy" : undefined}
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
