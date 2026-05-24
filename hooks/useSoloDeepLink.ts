"use client";

import { useMemo } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";

export type SoloDeepLink = {
  /** Theme ids requested via `?openSolo=true&themeId=…`/`&themeIds=a,b`, else undefined. */
  soloThemeIds: Id<"themes">[] | undefined;
  /** "practice_only" when the link forces that mode, else undefined. */
  soloInitialMode: "practice_only" | undefined;
  /** Stable key identifying this deep-link, or null when no solo link is present. */
  soloDeepLinkKey: string | null;
};

/**
 * Parses the home page's "open solo practice" deep-link out of the URL search
 * params. Pure parsing only — the page wires the parsed values (and decides when
 * to open the modal); the `as Id<"themes">[]` cast is localized here.
 */
export function useSoloDeepLink(searchParams: ReadonlyURLSearchParams): SoloDeepLink {
  const openSoloParam = searchParams.get("openSolo");
  const themeIdParam = searchParams.get("themeId");
  const themeIdsParam = searchParams.get("themeIds");
  const soloModeParam = searchParams.get("soloMode");

  const soloThemeIds = useMemo(
    () =>
      openSoloParam === "true"
        ? ((themeIdsParam
            ? themeIdsParam.split(",").filter(Boolean)
            : themeIdParam
              ? [themeIdParam]
              : []) as Id<"themes">[])
        : undefined,
    [openSoloParam, themeIdParam, themeIdsParam]
  );

  const soloInitialMode =
    openSoloParam === "true" && soloModeParam === "practice_only"
      ? "practice_only"
      : undefined;

  const soloDeepLinkKey =
    openSoloParam === "true"
      ? `${themeIdsParam ?? themeIdParam ?? ""}:${soloModeParam ?? ""}`
      : null;

  return { soloThemeIds, soloInitialMode, soloDeepLinkKey };
}
