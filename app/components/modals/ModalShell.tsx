"use client";

import { ReactNode, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { colors } from "@/lib/theme";

// SSR-safe mounting detection using useSyncExternalStore
const emptySubscribe = () => () => { };
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface ModalShellProps {
  children: ReactNode;
  title: string;
  maxHeight?: boolean;
  infoTooltip?: string;
  panelClassName?: string;
}

export function ModalShell({
  children,
  title,
  maxHeight = false,
  infoTooltip,
  panelClassName,
}: ModalShellProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isMounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[70] overflow-y-auto"
      data-modal-shell="true"
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className={[
            "w-full max-w-md rounded-3xl border-2 p-5 sm:p-6 backdrop-blur-sm",
            maxHeight ? "max-h-[80vh] flex flex-col min-h-0" : "",
            panelClassName ?? "",
          ].join(" ")}
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 20px 60px ${colors.primary.glow}`,
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-4 flex-shrink-0">
            <h2
              className="title-font text-xl sm:text-2xl font-bold"
              style={{ color: colors.text.DEFAULT }}
            >
              {title}
            </h2>
            {infoTooltip && (
              <div
                className="relative"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <button
                  type="button"
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition hover:brightness-110 focus:outline-none font-bold"
                  style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.DEFAULT,
                    color: colors.primary.light,
                  }}
                  aria-label="Information"
                >
                  <span className="text-xs leading-none font-bold">i</span>
                </button>
                {showTooltip && (
                  <div
                    className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1.5 px-4 py-3 rounded-lg border text-sm max-w-[280px] z-[60] whitespace-normal leading-relaxed"
                    style={{
                      backgroundColor: colors.background.elevated,
                      borderColor: colors.primary.dark,
                      color: colors.text.DEFAULT,
                      boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3)`,
                    }}
                  >
                    {infoTooltip}
                    <div
                      className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 border-l border-t"
                      style={{
                        backgroundColor: colors.background.elevated,
                        borderColor: colors.primary.dark,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
