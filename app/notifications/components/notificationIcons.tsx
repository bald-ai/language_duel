"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";

export function UserPlusIcon() {
  const colors = useAppearanceColors();
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.primary.DEFAULT} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

export function CalendarIcon() {
  const colors = useAppearanceColors();
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.DEFAULT} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

export function SwordIcon() {
  const colors = useAppearanceColors();
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.status.danger.DEFAULT} strokeWidth={2}>
      <g transform="rotate(45 12 12)">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 16a3 3 0 0 0 6 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v2" />
      </g>
    </svg>
  );
}

export function BellIcon() {
  const colors = useAppearanceColors();
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colors.neutral.DEFAULT} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
