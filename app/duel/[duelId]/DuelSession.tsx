"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import type { ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { DuelView } from "./components/DuelView";
import {
  useDuelSessionViewModel,
  type DuelPlayerSummary,
} from "./hooks/useDuelSessionViewModel";

interface DuelSessionProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
}

function DuelSessionMessage({ children }: { children: ReactNode }) {
  const colors = useAppearanceColors();
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: colors.background.DEFAULT, color: colors.text.DEFAULT }}
    >
      {children}
    </div>
  );
}

export default function DuelSession(props: DuelSessionProps) {
  const model = useDuelSessionViewModel(props);

  if (model.state === "signin") {
    return <DuelSessionMessage>Sign in first.</DuelSessionMessage>;
  }

  if (model.state === "forbidden") {
    return <DuelSessionMessage>You&apos;re not part of this duel</DuelSessionMessage>;
  }

  return <DuelView {...model.viewProps} />;
}
