"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useUserPreferences } from "@/app/components/UserPreferencesProvider";
import { getErrorMessage } from "@/lib/errors";

export function useExperimentalFeatures() {
  const { userPreferences, updateShowExperimentalFeatures } = useUserPreferences();
  const [isUpdating, setIsUpdating] = useState(false);

  const showExperimentalFeatures = userPreferences?.showExperimentalFeatures === true;

  const setShowExperimentalFeatures = useCallback(
    async (nextValue: boolean) => {
      if (isUpdating || nextValue === showExperimentalFeatures) return;

      setIsUpdating(true);
      try {
        await updateShowExperimentalFeatures(nextValue);
        toast.success(
          nextValue
            ? "Experimental features are now visible"
            : "Experimental features are now hidden"
        );
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to update experimental features"));
      } finally {
        setIsUpdating(false);
      }
    },
    [isUpdating, showExperimentalFeatures, updateShowExperimentalFeatures]
  );

  return {
    showExperimentalFeatures,
    setShowExperimentalFeatures,
    isUpdating,
  };
}
