"use client";

import { useState } from "react";
import { colors } from "@/lib/theme";

interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
  borderColor?: string;
}

/**
 * Shared Avatar component that handles broken image URLs by falling back
 * to a letter placeholder.
 */
export function Avatar({
  src,
  name,
  size = 48,
  className = "",
  borderColor = colors.neutral.DEFAULT,
}: AvatarProps) {
  const [error, setError] = useState(false);

  // Fallback initials (max 2 characters)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  if (src && !error) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setError(true)}
        className={`rounded-full border-2 object-cover shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          borderColor: borderColor,
        }}
      />
    );
  }

  return (
    <div
      className={`rounded-full border-2 flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: colors.primary.dark,
        borderColor: borderColor,
      }}
    >
      <span
        className="font-bold select-none"
        style={{
          color: colors.neutral.DEFAULT,
          fontSize: size * 0.4,
        }}
      >
        {initials}
      </span>
    </div>
  );
}

