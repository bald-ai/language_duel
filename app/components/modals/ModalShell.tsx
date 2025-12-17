"use client";

import { ReactNode } from "react";

interface ModalShellProps {
  children: ReactNode;
  title: string;
  maxHeight?: boolean;
}

export function ModalShell({ children, title, maxHeight = false }: ModalShellProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={[
          "bg-gray-800 border border-gray-700 p-6 rounded-lg max-w-md w-full mx-4",
          maxHeight ? "max-h-[85vh] flex flex-col overflow-hidden" : "",
        ].join(" ")}
      >
        <h2 className="text-xl font-bold mb-4 text-white">{title}</h2>
        {children}
      </div>
    </div>
  );
}

