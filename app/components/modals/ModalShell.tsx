"use client";

import { ReactNode } from "react";
import { colors } from "@/lib/theme";

interface ModalShellProps {
  children: ReactNode;
  title: string;
  maxHeight?: boolean;
}

export function ModalShell({ children, title, maxHeight = false }: ModalShellProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={[
          "w-full max-w-md rounded-3xl border-2 p-5 sm:p-6 backdrop-blur-sm",
          maxHeight ? "max-h-[80vh] flex flex-col min-h-0 overflow-hidden" : "",
        ].join(" ")}
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
      >
        <h2
          className="title-font text-xl sm:text-2xl font-bold text-center mb-4"
          style={{ color: colors.text.DEFAULT }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
