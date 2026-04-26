import Image from "next/image";

export function WeeklyGoalThemeMarker() {
  return (
    <Image
      src="/icons/goal.svg"
      alt="In your weekly goal"
      width={16}
      height={16}
      className="w-4 h-4 object-contain flex-shrink-0"
      title="In your weekly goal"
      data-testid="weekly-goal-theme-marker"
    />
  );
}
