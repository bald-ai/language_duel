"use client";

import { ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ModalShell } from "./ModalShell";
import {
  getThemeActionButtonStyle,
  themeActionButtonClassName,
  themeOutlineButtonClassName,
  getThemeOutlineButtonStyle,
} from "@/app/themes/components/themeStyles";

export interface ConfirmModalAction {
  label: string;
  onClick: () => void;
  testId?: string;
}

interface ConfirmModalProps {
  title: string;
  /** Body content: a message and any extra detail (highlight box, spinner, …). */
  children: ReactNode;
  confirm: ConfirmModalAction & { variant?: "primary" | "danger" };
  cancel: ConfirmModalAction;
  /** Optional middle action (e.g. "No" / skip), rendered as an outline button. */
  tertiary?: ConfirmModalAction;
  /** Disables every action while an operation is in flight. */
  busy?: boolean;
  /** data-testid placed on the modal root. */
  testId?: string;
}

/**
 * Shared confirm dialog built on ModalShell. The single home for confirm/cancel
 * dialogs (delete, regenerate, discard, …) so chrome and button styling live in
 * one place. When a `tertiary` action is present the confirm button leads
 * (Yes / No / Cancel); otherwise cancel leads (Cancel / Confirm).
 */
export function ConfirmModal({
  title,
  children,
  confirm,
  cancel,
  tertiary,
  busy = false,
  testId,
}: ConfirmModalProps) {
  const colors = useAppearanceColors();

  const confirmButton = (
    <button
      onClick={confirm.onClick}
      disabled={busy}
      className={themeActionButtonClassName}
      style={getThemeActionButtonStyle(confirm.variant === "danger" ? "danger" : "primary", colors)}
      data-testid={confirm.testId}
    >
      {confirm.label}
    </button>
  );

  const cancelButton = (
    <button
      onClick={cancel.onClick}
      disabled={busy}
      className={themeOutlineButtonClassName}
      style={getThemeOutlineButtonStyle(colors)}
      data-testid={cancel.testId}
    >
      {cancel.label}
    </button>
  );

  return (
    <ModalShell title={title} dataTestId={testId}>
      {children}
      <div className="flex gap-3">
        {tertiary ? (
          <>
            {confirmButton}
            <button
              onClick={tertiary.onClick}
              disabled={busy}
              className={themeOutlineButtonClassName}
              style={getThemeOutlineButtonStyle(colors)}
              data-testid={tertiary.testId}
            >
              {tertiary.label}
            </button>
            {cancelButton}
          </>
        ) : (
          <>
            {cancelButton}
            {confirmButton}
          </>
        )}
      </div>
    </ModalShell>
  );
}
