"use client";

import { useState } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES } from "@/lib/notificationPreferencesDefaults";

type ReminderOffsetInputProps = {
  label: string;
  valueMinutes: number;
  disabled: boolean;
  onChange: (minutes: number) => void;
  "data-testid"?: string;
};

export function ReminderOffsetInput({
  label,
  valueMinutes,
  disabled,
  onChange,
  "data-testid": testId,
}: ReminderOffsetInputProps) {
  const colors = useAppearanceColors();
  const [unit, setUnit] = useState<"minutes" | "hours">(
    valueMinutes >= 60 && valueMinutes % 60 === 0 ? "hours" : "minutes"
  );

  const displayValue = unit === "hours" ? valueMinutes / 60 : valueMinutes;

  const handleValueChange = (newValue: number) => {
    const minutes = unit === "hours" ? newValue * 60 : newValue;
    onChange(minutes);
  };

  const handleUnitChange = (newUnit: "minutes" | "hours") => {
    setUnit(newUnit);
  };

  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <span className="text-xs" style={{ color: colors.text.muted }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={unit === "hours" ? WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES / 60 : WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES}
          value={displayValue}
          disabled={disabled}
          onChange={(e) => handleValueChange(Number(e.target.value) || 1)}
          data-testid={testId}
          className="w-16 px-2 py-1 text-sm text-right rounded border-2"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
        />
        <select
          value={unit}
          disabled={disabled}
          onChange={(e) => handleUnitChange(e.target.value as "minutes" | "hours")}
          className="px-2 py-1 text-sm rounded border-2"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
        >
          <option value="minutes">min</option>
          <option value="hours">hrs</option>
        </select>
      </div>
    </div>
  );
}
