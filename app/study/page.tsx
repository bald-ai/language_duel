"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";
import { useHintManager, useTTS } from "./hooks";
import { StudyHeader, WordItem } from "./components";
import { ThemedPage } from "@/app/components/ThemedPage";
import { buttonStyles, colors } from "@/lib/theme";

interface Theme {
  _id: Id<"themes">;
  name: string;
  description: string;
  words: WordEntry[];
  createdAt: number;
}

const actionButtonClassName =
  "w-full bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg";

const actionButtonStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
  borderTopColor: buttonStyles.primary.border.top,
  borderBottomColor: buttonStyles.primary.border.bottom,
  borderLeftColor: buttonStyles.primary.border.sides,
  borderRightColor: buttonStyles.primary.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

export default function StudyPage() {
  const router = useRouter();

  // Fetch themes from Convex
  const themes = useQuery(api.themes.getThemes, {}) as Theme[] | undefined;

  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  // Custom hooks
  const {
    getHintState,
    revealLetter,
    revealFullWord,
    resetWord,
    resetAll,
  } = useHintManager();

  const { playingWordKey, playTTS } = useTTS();

  // Find the selected theme
  const selectedTheme =
    themes?.find((t) => t._id === selectedThemeId) || themes?.[0] || null;
  const currentVocabulary = selectedTheme?.words || [];

  const handleThemeChange = (themeId: string) => {
    setSelectedThemeId(themeId);
    resetAll();
  };

  const goBack = () => {
    router.push("/");
  };

  const header = (
    <header className="w-full flex flex-col items-center text-center pb-4 animate-slide-up shrink-0">
      <div
        className="w-16 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mb-3 rounded-full"
        style={{ color: colors.neutral.DEFAULT }}
      />

      <h1
        className="title-font text-3xl sm:text-4xl md:text-5xl tracking-tight leading-none"
        style={{
          background: `linear-gradient(135deg, ${colors.text.DEFAULT} 0%, ${colors.neutral.DEFAULT} 50%, ${colors.text.DEFAULT} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
        }}
      >
        Study{" "}
        <span
          style={{
            background: `linear-gradient(135deg, ${colors.cta.DEFAULT} 0%, ${colors.cta.lighter} 50%, ${colors.cta.DEFAULT} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Room
        </span>
      </h1>

      <p
        className="mt-2 text-xs sm:text-sm font-light tracking-wide"
        style={{ color: colors.text.muted }}
      >
        Train your vocabulary with focused themes
      </p>

      <div className="flex items-center gap-2 mt-3">
        <div
          className="w-8 h-px bg-gradient-to-r from-transparent to-current"
          style={{ color: colors.primary.DEFAULT }}
        />
        <div className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: colors.primary.DEFAULT }} />
        <div
          className="w-8 h-px bg-gradient-to-l from-transparent to-current"
          style={{ color: colors.primary.DEFAULT }}
        />
      </div>
    </header>
  );

  let content: ReactNode;

  if (themes === undefined) {
    content = (
      <div className="flex-1 flex flex-col items-center justify-center w-full animate-slide-up delay-200">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: colors.cta.light }}
        />
        <p className="mt-4 text-sm" style={{ color: colors.text.muted }}>
          Loading themes...
        </p>
      </div>
    );
  } else if (themes.length === 0) {
    content = (
      <>
        <section
          className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up delay-200"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 20px 60px ${colors.primary.glow}`,
          }}
        >
          <p className="text-base font-semibold" style={{ color: colors.text.DEFAULT }}>
            No themes available yet.
          </p>
          <p className="text-xs sm:text-sm mt-2" style={{ color: colors.text.muted }}>
            Go to the Themes section to generate vocabulary themes first.
          </p>
        </section>
        <div className="w-full mt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-slide-up delay-300">
          <button onClick={goBack} className={actionButtonClassName} style={actionButtonStyle}>
            Back
          </button>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <div className="w-full animate-slide-up delay-200">
          <StudyHeader
            themes={themes}
            selectedTheme={selectedTheme}
            isRevealed={isRevealed}
            onThemeChange={handleThemeChange}
            onToggleReveal={() => setIsRevealed(!isRevealed)}
          />
        </div>

        <section
          className="w-full flex-1 min-h-0 rounded-3xl border-2 p-4 pt-6 mb-4 overflow-y-auto backdrop-blur-sm animate-slide-up delay-300"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 20px 60px ${colors.primary.glow}`,
          }}
        >
          <div className="flex flex-col gap-3">
            {currentVocabulary.map((word) => {
              // Use content-based stable ID to prevent hint misalignment on reorder
              const stableId = `${word.word}-${word.answer}`;
              const wordKey = `${selectedTheme?._id}-${stableId}`;
              return (
                <WordItem
                  key={wordKey}
                  word={word}
                  isRevealed={isRevealed}
                  hintState={getHintState(wordKey)}
                  isPlaying={playingWordKey === wordKey}
                  onRevealLetter={(position) => revealLetter(wordKey, position)}
                  onRevealFullWord={() => revealFullWord(wordKey, word.answer)}
                  onReset={() => resetWord(wordKey)}
                  onPlayTTS={() => playTTS(wordKey, word.answer)}
                />
              );
            })}
          </div>
        </section>

        <div className="w-full grid grid-cols-2 gap-3 flex-shrink-0 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-slide-up delay-400">
          <button onClick={goBack} className={actionButtonClassName} style={actionButtonStyle}>
            Back
          </button>
          <button onClick={resetAll} className={actionButtonClassName} style={actionButtonStyle}>
            Reset All
          </button>
        </div>
      </>
    );
  }

  return (
    <ThemedPage>
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-start w-full max-w-xl mx-auto px-6 pt-6 pb-0">
        {header}
        {content}
      </div>
      <div
        className="relative z-10 h-1"
        style={{
          background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
        }}
      />
    </ThemedPage>
  );
}
