"use client";

import type { MouseEvent, KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";

interface ThemeCardMenuProps {
  themeId: Id<"themes">;
  themeName: string;
  isOwner: boolean;
  isDeleting: boolean;
  isDuplicating: boolean;
  onDuplicate: (themeId: Id<"themes">) => void;
  onDelete: (themeId: Id<"themes">, themeName: string) => void;
}

interface DropdownPosition {
  top: number;
  right: number;
}

export const ThemeCardMenu = memo(function ThemeCardMenu({
  themeId,
  themeName,
  isOwner,
  isDeleting,
  isDuplicating,
  onDuplicate,
  onDelete,
}: ThemeCardMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMutating = isDeleting || isDuplicating;

  const handleToggle = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const handleDuplicate = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onDuplicate(themeId);
      setIsOpen(false);
    },
    [onDuplicate, themeId]
  );

  const handleDelete = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onDelete(themeId, themeName);
      setIsOpen(false);
    },
    [onDelete, themeId, themeName]
  );

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, []);

  // Calculate dropdown position when opened
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };

    updatePosition();

    // Update position on scroll/resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const dropdownMenu = isOpen ? (
    <div
      ref={menuRef}
      className="fixed w-44 rounded-2xl p-2 shadow-xl"
      style={{
        top: position.top,
        right: position.right,
        backgroundColor: "#FFFFFF",
        zIndex: 9999,
      }}
      role="menu"
      onKeyDown={handleKeyDown}
    >
      <button
        onClick={handleDuplicate}
        disabled={isMutating}
        className="w-full text-left px-4 py-3 rounded-xl font-medium text-base transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "transparent",
          color: colors.secondary.light,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `${colors.secondary.DEFAULT}15`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        role="menuitem"
      >
        {isDuplicating ? "Duplicating..." : "Duplicate"}
      </button>

      {isOwner && (
        <button
          onClick={handleDelete}
          disabled={isMutating}
          className="w-full text-left px-4 py-3 rounded-xl font-medium text-base transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "transparent",
            color: colors.status.danger.light,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.status.danger.DEFAULT}15`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          role="menuitem"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={isMutating}
        className="p-1.5 rounded-lg transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: isOpen ? `${colors.text.muted}20` : "transparent",
        }}
        aria-label="Theme actions"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
          style={{ color: isOpen ? colors.text.DEFAULT : colors.text.muted }}
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {typeof document !== "undefined" && createPortal(dropdownMenu, document.body)}
    </div>
  );
});
