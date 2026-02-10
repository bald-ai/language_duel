"use client";

import { useState } from "react";
import { colors } from "@/lib/theme";

interface DeleteGoalButtonProps {
    onDelete: () => Promise<void>;
}

export function DeleteGoalButton({ onDelete }: DeleteGoalButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onDelete();
        } finally {
            setIsDeleting(false);
            setShowConfirm(false);
        }
    };

    // Confirmation dialog
    if (showConfirm) {
        return (
            <div
                className="p-4 rounded-2xl border-2 space-y-4"
                style={{
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.status.danger.DEFAULT,
                }}
            >
                <p
                    className="text-center text-sm"
                    style={{ color: colors.text.DEFAULT }}
                >
                    This will delete the goal for both you and your partner. Continue?
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowConfirm(false)}
                        disabled={isDeleting}
                        className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider border-2 transition-colors"
                        style={{
                            backgroundColor: colors.background.elevated,
                            borderColor: colors.primary.dark,
                            color: colors.text.DEFAULT,
                        }}
                        data-testid="goals-delete-cancel"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        style={{
                            backgroundColor: colors.status.danger.DEFAULT,
                            color: "white",
                            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                        }}
                        data-testid="goals-delete-confirm"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        );
    }

    // Default delete button
    return (
	    <button
	        onClick={() => setShowConfirm(true)}
	        className="w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-colors border-2"
	        style={{
	            backgroundColor: colors.background.elevated,
	            borderColor: colors.status.danger.DEFAULT,
	            color: colors.status.danger.light,
	        }}
	        data-testid="goals-delete"
	    >
	        Delete Goal
	    </button>
	    );
	}
