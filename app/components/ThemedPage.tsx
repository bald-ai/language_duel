"use client";

import { ReactNode } from "react";
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
  const rootClassName = [
    "min-h-screen overflow-y-auto flex flex-col relative",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      {/* Background image layer - Fixed to viewport for consistent scaling */}
      {backgroundImage && (
        <div className="fixed inset-0 -z-10">
          <Image
            src={backgroundImage}
            alt="Background"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: backgroundFocalPoint }}
            sizes="100vw"
          />
        </div>
      )}
      
      {/* Darker bottom gradient to anchor the buttons */}
      <div 
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.9) 100%)"
        }}
      />
      
      {/* Gradient overlay layer - Fixed to viewport */}
      <div
        className="fixed inset-0 animated-gradient -z-10"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.primary.DEFAULT}66 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 100% 100%, ${colors.cta.DEFAULT}40 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 0% 80%, ${colors.secondary.DEFAULT}40 0%, transparent 50%),
            linear-gradient(180deg, ${colors.background.DEFAULT}99 0%, ${colors.background.elevated}99 50%, ${colors.background.DEFAULT}99 100%)
          `,
        }}
      />

      <div
        className="fixed top-20 left-10 w-32 h-32 rounded-full blur-3xl -z-10"
        style={{ backgroundColor: `${colors.primary.DEFAULT}1A` }}
      />
      <div
        className="fixed bottom-40 right-10 w-40 h-40 rounded-full blur-3xl -z-10"
        style={{ backgroundColor: `${colors.cta.DEFAULT}1A` }}
      />
      <div
        className="fixed top-1/2 left-1/4 w-24 h-24 rounded-full blur-2xl -z-10"
        style={{ backgroundColor: `${colors.secondary.DEFAULT}1A` }}
      />

      {children}
    </div>
  );
}
