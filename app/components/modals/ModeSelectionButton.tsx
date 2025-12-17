"use client";

interface ModeSelectionButtonProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  selectedColor?: "blue" | "purple";
}

export function ModeSelectionButton({
  selected,
  onClick,
  title,
  description,
  selectedColor = "blue",
}: ModeSelectionButtonProps) {
  const colorClasses = {
    blue: {
      border: "border-blue-500/80 bg-blue-500/10",
      title: "text-blue-300",
      check: "border-blue-400 bg-blue-500",
    },
    purple: {
      border: "border-purple-500/80 bg-purple-500/10",
      title: "text-purple-300",
      check: "border-purple-400 bg-purple-500",
    },
  };

  const colors = colorClasses[selectedColor];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "w-full text-left p-5 rounded-2xl border-2 transition-colors",
        "flex items-center justify-between gap-4",
        selected ? colors.border : "border-gray-700 hover:bg-gray-700 hover:border-gray-600",
      ].join(" ")}
    >
      <div>
        <div className={["font-bold text-2xl", selected ? colors.title : "text-white"].join(" ")}>
          {title}
        </div>
        <div className="text-sm text-gray-300">{description}</div>
      </div>
      <div
        className={[
          "w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0",
          selected ? colors.check : "border-gray-500/80 bg-transparent",
        ].join(" ")}
      >
        {selected && <CheckIcon />}
      </div>
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16.5 5.5L8.25 13.75L3.5 9"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

