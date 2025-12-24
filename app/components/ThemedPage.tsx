"use client";

import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import { colors } from "@/lib/theme";

interface ThemedPageProps {
  children: ReactNode;
  className?: string;
  backgroundImage?: string;
  backgroundFocalPoint?: string;
}

export function ThemedPage({ 
  children, 
  className, 
  backgroundImage = "/background.png",
  backgroundFocalPoint = "50% 30%"
}: ThemedPageProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
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
    const handleVisibilityChange = () => {
      setReduceMotion(document.hidden);
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
    <div
      className={rootClassName}
      data-paused={reduceMotion && isMobile ? "true" : undefined}
      data-reduce-motion={reduceMotion ? "true" : undefined}
    >
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
        {backgroundImage && (
          <Image
            src={backgroundImage}
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
        
        {/* Darker bottom gradient to anchor the buttons */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.9) 100%)"
          }}
        />
        
        {/* Gradient overlay layer */}
        <div
          className={`absolute inset-0 ${reduceMotion ? "" : "animated-gradient"}`}
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.primary.DEFAULT}66 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 100% 100%, ${colors.cta.DEFAULT}40 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 0% 80%, ${colors.secondary.DEFAULT}40 0%, transparent 50%),
              linear-gradient(180deg, ${colors.background.DEFAULT}99 0%, ${colors.background.elevated}99 50%, ${colors.background.DEFAULT}99 100%)
            `,
          }}
        />

        {/* Decorative blurred circles */}
        <div
          className="absolute top-20 left-10 w-32 h-32 rounded-full blur-md md:blur-3xl"
          style={{ backgroundColor: `${colors.primary.DEFAULT}1A`, contentVisibility: "auto" }}
        />
        <div
          className="absolute bottom-40 right-10 w-40 h-40 rounded-full blur-md md:blur-3xl"
          style={{ backgroundColor: `${colors.cta.DEFAULT}1A`, contentVisibility: "auto" }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-24 h-24 rounded-full blur-sm md:blur-2xl"
          style={{ backgroundColor: `${colors.secondary.DEFAULT}1A`, contentVisibility: "auto" }}
        />
      </div>

      {children}
    </div>
  );
}
