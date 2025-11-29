"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Types matching Convex schema
interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

interface Theme {
  _id: Id<"themes">;
  name: string;
  description: string;
  words: WordEntry[];
  createdAt: number;
}

type ViewMode = "list" | "detail" | "edit-word";
type EditMode = "choice" | "generate" | "manual";

// Helper to check if a theme has duplicate wrong answers
function checkThemeForDuplicateWrongAnswers(words: WordEntry[]): boolean {
  for (const word of words) {
    const uniqueWrongs = new Set(word.wrongAnswers);
    if (uniqueWrongs.size !== word.wrongAnswers.length) {
      return true; // Has duplicates
    }
  }
  return false;
}

// Helper to check if a theme has duplicate words (same English word appearing multiple times)
function checkThemeForDuplicateWords(words: WordEntry[]): boolean {
  const wordSet = new Set<string>();
  for (const word of words) {
    const lowerWord = word.word.toLowerCase().trim();
    if (wordSet.has(lowerWord)) {
      return true; // Has duplicate word
    }
    wordSet.add(lowerWord);
  }
  return false;
}

// Helper to get indices of duplicate words in theme
function getDuplicateWordIndices(words: WordEntry[]): Set<number> {
  const wordMap = new Map<string, number[]>();
  words.forEach((word, index) => {
    const lowerWord = word.word.toLowerCase().trim();
    if (!wordMap.has(lowerWord)) {
      wordMap.set(lowerWord, []);
    }
    wordMap.get(lowerWord)!.push(index);
  });
  
  const duplicateIndices = new Set<number>();
  for (const indices of wordMap.values()) {
    if (indices.length > 1) {
      indices.forEach(idx => duplicateIndices.add(idx));
    }
  }
  return duplicateIndices;
}

// Helper to build the prompt that will be shown to user
function buildPromptPreview(
  type: "theme" | "word" | "answer" | "wrong",
  themeName: string,
  currentWord?: string,
  currentAnswer?: string,
  currentWrongAnswers?: string[],
  wrongIndex?: number,
  history?: { role: string; content: string }[],
  existingWords?: string[],
  rejectedWords?: string[]
): string {
  let prompt = "";
  
  if (type === "theme") {
    prompt = `SYSTEM: You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly 20 English vocabulary words for the theme "${themeName}" with Spanish translations.

REQUIREMENTS:
- Each word must be an English noun related to "${themeName}"
- The answer must be the correct Spanish translation
- Each word needs exactly 4 wrong answers (Spanish)
- Wrong answers must be CHALLENGING and tricky (can include grammar mistakes)
- All 20 words must be unique within this theme`;
  } else if (type === "word") {
    const existingWordsList = existingWords && existingWords.length > 0
      ? existingWords.join(", ")
      : "(none)";
    
    const rejectedWordsList = rejectedWords && rejectedWords.length > 0
      ? `\n\nREJECTED SUGGESTIONS (DO NOT REPEAT): ${rejectedWords.join(", ")}`
      : "";
    
    prompt = `SYSTEM: You generate vocabulary flashcards. Given a theme, you produce an English word with its correct Spanish translation and 4 challenging wrong Spanish answers.

TASK: Replace "${currentWord}" with a NEW English word for the theme "${themeName}".

EXISTING WORDS (DO NOT DUPLICATE): ${existingWordsList}${rejectedWordsList}

REQUIREMENTS:
- New word must be a different English noun fitting the theme
- Must NOT duplicate any existing word or rejected suggestion
- Include correct Spanish translation
- Include 4 tricky wrong Spanish answers (similar-sounding, subtle differences, plausible mistakes)`;
  } else if (type === "answer") {
    prompt = `SYSTEM: You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Provide a better Spanish translation for the English word.

CONTEXT:
- Theme: "${themeName}"
- English word: ${currentWord}
- Current answer (Spanish): ${currentAnswer}
- Wrong answers (Spanish): ${currentWrongAnswers?.join(", ")}

Provide the most accurate Spanish translation.`;
  } else if (type === "wrong") {
    const otherWrongs = currentWrongAnswers?.filter((_, i) => i !== wrongIndex) || [];
    prompt = `SYSTEM: You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Generate a NEW challenging wrong Spanish answer.

CONTEXT:
- Theme: "${themeName}"
- English word: ${currentWord}
- Correct answer (Spanish): ${currentAnswer}
- Wrong answer to replace: "${currentWrongAnswers?.[wrongIndex ?? 0]}"
- Keep these other wrong answers: ${otherWrongs.join(", ")}

REQUIREMENTS:
- Must be CHALLENGING and tricky
- Can include grammar mistakes or wrong gender articles
- Must NOT be the correct answer
- Must NOT duplicate existing wrong answers`;
  }

  // Add history if present
  if (history && history.length > 0) {
    prompt += "\n\n--- CONVERSATION HISTORY ---";
    for (const h of history) {
      prompt += `\n${h.role.toUpperCase()}: ${h.content}`;
    }
  }

  return prompt;
}

export default function ThemesPage() {
  const router = useRouter();
  
  // Convex queries/mutations
  const themes = useQuery(api.themes.getThemes) || [];
  const createTheme = useMutation(api.themes.createTheme);
  const updateTheme = useMutation(api.themes.updateTheme);
  const deleteThemeMutation = useMutation(api.themes.deleteTheme);
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [localWords, setLocalWords] = useState<WordEntry[]>([]); // Local edits before save
  
  // Generate new theme state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  
  // Edit word state
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<"word" | "answer" | "wrong" | null>(null);
  const [editingWrongIndex, setEditingWrongIndex] = useState<number>(0);
  const [editMode, setEditMode] = useState<EditMode>("choice");
  const [manualValue, setManualValue] = useState("");
  const [generatedValue, setGeneratedValue] = useState("");
  const [generatedWordData, setGeneratedWordData] = useState<WordEntry | null>(null); // Full word data for word regeneration
  const [oldValue, setOldValue] = useState("");
  const [conversationHistory, setConversationHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [rejectedWords, setRejectedWords] = useState<string[]>([]); // Track rejected word suggestions
  
  // Regenerate confirmation modal state (for manual word edits)
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [pendingManualWord, setPendingManualWord] = useState<string>(""); // The new word to save
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Navigation
  const goBack = () => {
    if (viewMode === "edit-word") {
      setViewMode("detail");
      setEditingWordIndex(null);
      setEditingField(null);
      setEditMode("choice");
      setManualValue("");
      setGeneratedValue("");
      setGeneratedWordData(null);
      setConversationHistory([]);
      setCurrentPrompt("");
      setRejectedWords([]);
    } else if (viewMode === "detail") {
      setViewMode("list");
      setSelectedTheme(null);
      setLocalWords([]);
    } else {
      router.push("/");
    }
  };

  // Theme actions
  const openTheme = (theme: Theme) => {
    setSelectedTheme(theme);
    setLocalWords([...theme.words]);
    setViewMode("detail");
  };

  const handleDeleteTheme = async (themeId: Id<"themes">) => {
    if (!confirm("Are you sure you want to delete this theme?")) return;
    try {
      await deleteThemeMutation({ themeId });
    } catch (error) {
      console.error("Failed to delete theme:", error);
      alert("Failed to delete theme");
    }
  };

  const handleGenerateNewTheme = async () => {
    if (!newThemeName.trim()) return;
    
    setIsGenerating(true);
    setGenerateError(null);
    
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "theme",
          themeName: newThemeName,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Generation failed");
      }
      
      // Create theme in Convex
      await createTheme({
        name: newThemeName,
        description: `Generated theme for: ${newThemeName}`,
        words: data.data,
      });
      
      setShowGenerateModal(false);
      setNewThemeName("");
    } catch (error) {
      console.error("Generate error:", error);
      setGenerateError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Word editing actions
  const startEditWord = (wordIndex: number, field: "word" | "answer" | "wrong", wrongIndex?: number) => {
    const word = localWords[wordIndex];
    setEditingWordIndex(wordIndex);
    setEditingField(field);
    setEditingWrongIndex(wrongIndex ?? 0);
    
    let value = "";
    if (field === "word") value = word.word;
    else if (field === "answer") value = word.answer;
    else value = word.wrongAnswers[wrongIndex ?? 0];
    
    setOldValue(value);
    setViewMode("edit-word");
    // For answer field, go directly to manual edit mode (skip regeneration flow)
    setEditMode(field === "answer" ? "manual" : "choice");
    setManualValue(field === "answer" ? value : "");
    setGeneratedValue("");
    setGeneratedWordData(null);
    setConversationHistory([]);
    setRejectedWords([]);
    
    // Get existing words for duplicate prevention (only for word regeneration)
    const existingWords = field === "word" 
      ? localWords.filter((_, idx) => idx !== wordIndex).map(w => w.word)
      : undefined;
    
    // Build initial prompt
    const prompt = buildPromptPreview(
      field,
      selectedTheme?.name || "",
      word.word,
      word.answer,
      word.wrongAnswers,
      wrongIndex,
      undefined,
      existingWords,
      [] // No rejected words yet
    );
    setCurrentPrompt(prompt);
  };

  const handleGenerate = async (overrideRejectedWords?: string[]) => {
    if (editingWordIndex === null || !editingField || !selectedTheme) return;
    
    const word = localWords[editingWordIndex];
    setIsGenerating(true);
    
    // Use override if provided (for regeneration), otherwise use state
    const currentRejectedWords = overrideRejectedWords ?? rejectedWords;
    
    try {
      // Get all other words in the theme to avoid duplicates
      const existingWords = localWords
        .filter((_, idx) => idx !== editingWordIndex)
        .map(w => w.word);
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "field",
          fieldType: editingField,
          themeName: selectedTheme.name,
          currentWord: word.word,
          currentAnswer: word.answer,
          currentWrongAnswers: word.wrongAnswers,
          fieldIndex: editingWrongIndex,
          existingWords: editingField === "word" ? existingWords : undefined,
          rejectedWords: editingField === "word" ? currentRejectedWords : undefined,
          history: conversationHistory,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Generation failed");
      }
      
      // Extract generated value based on field type
      let newValue = "";
      if (editingField === "word") {
        newValue = data.data.word;
        // Store full word data but don't save yet - wait for Accept
        setGeneratedWordData({
          word: data.data.word,
          answer: data.data.answer,
          wrongAnswers: data.data.wrongAnswers,
        });
        setGeneratedValue(data.data.word);
      } else if (editingField === "answer") {
        newValue = data.data.answer;
        setGeneratedValue(newValue);
      } else {
        newValue = data.data.wrongAnswer;
        setGeneratedValue(newValue);
      }
      
      // Update history
      setConversationHistory(prev => [
        ...prev,
        { role: "assistant" as const, content: `Generated: ${newValue}` },
      ]);
      
      // Update prompt - for word field, include the just-generated word in rejected list
      // so user sees what will be excluded on next regeneration
      const promptRejectedWords = editingField === "word" 
        ? [...currentRejectedWords, newValue]
        : undefined;
      
      const updatedPrompt = buildPromptPreview(
        editingField,
        selectedTheme.name,
        word.word,
        word.answer,
        word.wrongAnswers,
        editingWrongIndex,
        editingField !== "word" ? [...conversationHistory, { role: "assistant", content: `Generated: ${newValue}` }] : undefined,
        editingField === "word" ? existingWords : undefined,
        promptRejectedWords
      );
      setCurrentPrompt(updatedPrompt);
      
      setEditMode("generate");
    } catch (error) {
      console.error("Generate error:", error);
      alert(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManual = () => {
    setManualValue(oldValue);
    setEditMode("manual");
  };

  const handleAcceptGenerated = () => {
    if (editingWordIndex === null || !editingField) return;
    
    const updatedWords = [...localWords];
    const word = { ...updatedWords[editingWordIndex] };
    
    if (editingField === "word") {
      // Apply the stored word data now
      if (generatedWordData) {
        updatedWords[editingWordIndex] = generatedWordData;
        setLocalWords(updatedWords);
      }
    } else if (editingField === "answer") {
      word.answer = generatedValue;
      updatedWords[editingWordIndex] = word;
      setLocalWords(updatedWords);
    } else {
      word.wrongAnswers = [...word.wrongAnswers];
      word.wrongAnswers[editingWrongIndex] = generatedValue;
      updatedWords[editingWordIndex] = word;
      setLocalWords(updatedWords);
    }
    
    goBack();
  };

  const handleRegenerate = async () => {
    // For word regeneration, track the rejected word
    let updatedRejectedWords = rejectedWords;
    if (editingField === "word" && generatedValue) {
      updatedRejectedWords = [...rejectedWords, generatedValue];
      setRejectedWords(updatedRejectedWords);
    }
    
    // Add user feedback to history (for non-word fields)
    if (editingField !== "word") {
      const feedback = currentPrompt.includes("USER:") 
        ? currentPrompt.split("USER:").pop()?.trim() || "Please try again"
        : "Please generate a different option";
      
      setConversationHistory(prev => [
        ...prev,
        { role: "user" as const, content: feedback },
      ]);
    }
    
    // Regenerate with updated rejected words
    await handleGenerate(updatedRejectedWords);
  };

  const handleSaveManual = () => {
    if (editingWordIndex === null || !editingField) return;
    
    // If editing word field and value changed, show regeneration prompt
    if (editingField === "word" && manualValue.trim() !== oldValue.trim()) {
      setPendingManualWord(manualValue);
      setShowRegenerateModal(true);
      return;
    }
    
    // For other fields, save directly
    const updatedWords = [...localWords];
    const word = { ...updatedWords[editingWordIndex] };
    
    if (editingField === "word") {
      word.word = manualValue;
    } else if (editingField === "answer") {
      word.answer = manualValue;
    } else {
      word.wrongAnswers = [...word.wrongAnswers];
      word.wrongAnswers[editingWrongIndex] = manualValue;
    }
    
    updatedWords[editingWordIndex] = word;
    setLocalWords(updatedWords);
    goBack();
  };
  
  // Handle "No" - just save the word without regenerating answer/wrongs
  const handleSaveWordOnly = () => {
    if (editingWordIndex === null) return;
    
    const updatedWords = [...localWords];
    const word = { ...updatedWords[editingWordIndex] };
    word.word = pendingManualWord;
    updatedWords[editingWordIndex] = word;
    setLocalWords(updatedWords);
    
    setShowRegenerateModal(false);
    setPendingManualWord("");
    goBack();
  };
  
  // Handle "Yes" - regenerate answer and wrong answers for the new word
  const handleRegenerateForWord = async () => {
    if (editingWordIndex === null || !selectedTheme) return;
    
    setIsRegenerating(true);
    
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "regenerate-for-word",
          themeName: selectedTheme.name,
          newWord: pendingManualWord,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Regeneration failed");
      }
      
      // Update localWords with new word, answer, and wrong answers
      const updatedWords = [...localWords];
      updatedWords[editingWordIndex] = {
        word: pendingManualWord,
        answer: data.data.answer,
        wrongAnswers: data.data.wrongAnswers,
      };
      setLocalWords(updatedWords);
      
      setShowRegenerateModal(false);
      setPendingManualWord("");
      goBack();
    } catch (error) {
      console.error("Regenerate error:", error);
      alert(error instanceof Error ? error.message : "Regeneration failed");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Save entire theme
  const handleSaveTheme = async () => {
    if (!selectedTheme) return;
    
    // Check for duplicate words in theme
    if (checkThemeForDuplicateWords(localWords)) {
      alert("Cannot save: This theme has duplicate words. Please fix the duplicate words (marked with red !) before saving.");
      return;
    }
    
    // Check for duplicate wrong answers
    if (checkThemeForDuplicateWrongAnswers(localWords)) {
      alert("Cannot save: This theme has duplicate wrong answers. Please fix the duplicate wrong answers (marked with orange ⚠) before saving.");
      return;
    }
    
    try {
      await updateTheme({
        themeId: selectedTheme._id,
        words: localWords,
      });
      setViewMode("list");
      setSelectedTheme(null);
      setLocalWords([]);
    } catch (error) {
      console.error("Failed to save theme:", error);
      alert("Failed to save theme");
    }
  };

  const handleCancelTheme = () => {
    setViewMode("list");
    setSelectedTheme(null);
    setLocalWords([]);
  };

  // Render theme list view
  const renderListView = () => (
    <>
      <header className="w-full mb-6">
        <div className="w-full bg-gray-300 border-2 border-gray-400 rounded-lg py-3 px-4 mb-4">
          <h1 className="text-xl font-bold text-center text-gray-800 uppercase tracking-wide">
            Themes
          </h1>
        </div>
        
        {/* Generate New Button */}
        <button
          onClick={() => setShowGenerateModal(true)}
          className="w-full bg-gray-200 border-2 border-gray-400 rounded-xl py-3 text-lg font-bold text-gray-800 uppercase tracking-wide hover:bg-gray-300 transition-colors"
        >
          Generate New
        </button>
      </header>

      {/* Themes List */}
      <div className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl p-4 mb-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {themes.map((theme) => (
            <div
              key={theme._id}
              className="w-full p-4 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <div className="flex justify-between items-start">
                <button
                  onClick={() => openTheme(theme as Theme)}
                  className="text-left flex-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-gray-800">{theme.name}</span>
                    {checkThemeForDuplicateWords(theme.words) && (
                      <span className="text-red-500 text-xl font-bold" title="This theme has duplicate words">!</span>
                    )}
                    {checkThemeForDuplicateWrongAnswers(theme.words) && (
                      <span className="text-orange-500 text-xl font-bold" title="This theme has duplicate wrong answers">⚠</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">{theme.words.length} words</div>
                </button>
                <button
                  onClick={() => handleDeleteTheme(theme._id)}
                  className="ml-2 px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={goBack}
        className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl py-4 text-xl font-bold text-gray-800 uppercase tracking-wide hover:bg-gray-300"
      >
        Back
      </button>

      {/* Generate New Theme Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border-2 border-gray-400">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">New Theme</h2>
            
            <div className="mb-6">
              <input
                type="text"
                value={newThemeName}
                onChange={(e) => setNewThemeName(e.target.value)}
                placeholder="Example: Bathroom items"
                className="w-full p-4 border-2 border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter a theme name or description for word generation
              </p>
            </div>

            {generateError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-xl text-red-700 text-sm">
                {generateError}
              </div>
            )}

            {isGenerating && (
              <div className="mb-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Generating 20 words... This may take a moment.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleGenerateNewTheme}
                disabled={!newThemeName.trim() || isGenerating}
                className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-bold uppercase disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setNewThemeName("");
                  setGenerateError(null);
                }}
                disabled={isGenerating}
                className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-xl py-3 font-bold text-gray-800 uppercase hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Render theme detail view
  const renderDetailView = () => {
    if (!selectedTheme) return null;

    return (
      <div className="fixed inset-0 flex flex-col bg-gray-100">
        {/* Fixed Header */}
        <header className="flex-shrink-0 w-full max-w-md mx-auto px-4 pt-6 pb-4">
          <div className="w-full bg-gray-300 border-2 border-gray-400 rounded-lg py-3 px-4">
            <h1 className="text-xl font-bold text-center text-gray-800 uppercase tracking-wide">
              {selectedTheme.name}
            </h1>
          </div>
        </header>

        {/* Scrollable Words List */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-gray-200 border-2 border-gray-400 rounded-2xl p-4">
              <div className="flex flex-col gap-4">
                {localWords.map((word, index) => (
                  <div
                    key={index}
                    className="bg-white border-2 border-gray-300 rounded-xl p-4"
                  >
                    {/* Word number - red if duplicate word, orange if duplicate wrong answers */}
                    <div className="flex items-center gap-2 mb-3">
                      {(() => {
                        const duplicateWordIndices = getDuplicateWordIndices(localWords);
                        const isDuplicateWord = duplicateWordIndices.has(index);
                        const hasDuplicateWrongAnswers = new Set(word.wrongAnswers).size !== word.wrongAnswers.length;
                        
                        let badgeClass = "border-gray-400 text-gray-600";
                        if (isDuplicateWord) {
                          badgeClass = "border-red-500 text-red-500 bg-red-50";
                        } else if (hasDuplicateWrongAnswers) {
                          badgeClass = "border-orange-500 text-orange-500 bg-orange-50";
                        }
                        
                        return (
                          <>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${badgeClass}`}>
                              {index + 1}
                            </div>
                            {isDuplicateWord && (
                              <span className="text-red-500 text-sm font-bold" title="Duplicate word in theme">!</span>
                            )}
                            {hasDuplicateWrongAnswers && (
                              <span className="text-orange-500 text-sm font-bold" title="Duplicate wrong answers">⚠</span>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Word & Answer Row - Blue/Green tones */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        onClick={() => startEditWord(index, "word")}
                        className="p-2 bg-blue-50 border-2 border-blue-200 rounded-lg text-sm font-medium text-blue-900 hover:bg-blue-100 hover:border-blue-300 transition-colors text-center"
                      >
                        <div className="text-xs text-blue-500 mb-1">Word</div>
                        {word.word}
                      </button>
                      <button
                        onClick={() => startEditWord(index, "answer")}
                        className="p-2 bg-green-50 border-2 border-green-200 rounded-lg text-sm font-medium text-green-900 hover:bg-green-100 hover:border-green-300 transition-colors text-center"
                      >
                        <div className="text-xs text-green-500 mb-1">Answer</div>
                        {word.answer}
                      </button>
                    </div>

                    {/* Wrong Answers Grid - Orange/Red tones */}
                    <div className="grid grid-cols-2 gap-2">
                      {word.wrongAnswers.map((wrongAnswer, wrongIdx) => (
                        <button
                          key={wrongIdx}
                          onClick={() => startEditWord(index, "wrong", wrongIdx)}
                          className="p-2 bg-orange-50 border-2 border-orange-200 rounded-lg text-sm font-medium text-orange-900 hover:bg-orange-100 hover:border-orange-300 transition-colors text-center"
                        >
                          <div className="text-xs text-orange-500 mb-1">Wrong {wrongIdx + 1}</div>
                          {wrongAnswer}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Bottom spacer for fixed footer */}
            <div className="h-24"></div>
          </div>
        </div>

        {/* Fixed Bottom Buttons */}
        <div className="flex-shrink-0 w-full bg-gray-100 border-t border-gray-300 px-4 py-4">
          <div className="w-full max-w-md mx-auto flex gap-3">
            <button
              onClick={handleSaveTheme}
              className="flex-1 bg-gray-800 text-white rounded-2xl py-4 text-lg font-bold uppercase hover:bg-gray-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancelTheme}
              className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-2xl py-4 text-lg font-bold text-gray-800 uppercase hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render edit word view
  const renderEditWordView = () => {
    if (editingWordIndex === null || !editingField) return null;

    const fieldLabel = editingField === "word" 
      ? "Word" 
      : editingField === "answer" 
        ? "Answer" 
        : `Wrong ${editingWrongIndex + 1}`;

    return (
      <>
        <header className="w-full mb-4">
          <div className="w-full bg-gray-300 border-2 border-gray-400 rounded-lg py-3 px-4">
            <h1 className="text-xl font-bold text-center text-gray-800 uppercase tracking-wide">
              Edit {fieldLabel}
            </h1>
          </div>
        </header>

        <div className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl p-4 mb-4 flex-1 overflow-auto">
          {/* Current Value Display */}
          <div className="mb-4 p-3 bg-white border-2 border-gray-300 rounded-xl">
            <div className="text-xs text-gray-500 mb-1">Current Value</div>
            <div className="text-lg font-bold text-gray-800">{oldValue}</div>
          </div>

          {/* Raw Prompt Display - hide for answer manual edit */}
          {!(editingField === "answer" && editMode === "manual") && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1">Prompt (editable for feedback)</div>
              <textarea
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-800 font-mono text-xs focus:border-gray-500 focus:outline-none resize-none"
                rows={12}
              />
            </div>
          )}

          {/* Choice Mode */}
          {editMode === "choice" && (
            <div className="flex gap-3">
              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-bold uppercase hover:bg-gray-700 transition-colors disabled:bg-gray-500"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
              <button
                onClick={handleManual}
                className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-xl py-3 font-bold text-gray-800 uppercase hover:bg-gray-300 transition-colors"
              >
                Manually
              </button>
              <button
                onClick={goBack}
                className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-xl py-3 font-bold text-gray-800 uppercase hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Generate Mode */}
          {editMode === "generate" && (
            <>
              {/* Old vs New Comparison */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-white border-2 border-gray-300 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">Old {fieldLabel}</div>
                  <div className="text-lg font-bold text-gray-800">{oldValue}</div>
                </div>
                <div className="p-3 bg-green-50 border-2 border-green-300 rounded-xl">
                  <div className="text-xs text-green-600 mb-1">New {fieldLabel}</div>
                  <div className="text-lg font-bold text-green-800">{generatedValue}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAcceptGenerated}
                  className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold uppercase hover:bg-green-700 transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-bold uppercase hover:bg-gray-700 transition-colors disabled:bg-gray-500"
                >
                  {isGenerating ? "..." : "Regenerate"}
                </button>
                <button
                  onClick={goBack}
                  className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-xl py-3 font-bold text-gray-800 uppercase hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Manual Mode */}
          {editMode === "manual" && (
            <>
              {/* Manual Input */}
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">Enter new value:</div>
                <input
                  type="text"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  className="w-full p-4 border-2 border-gray-300 rounded-xl text-gray-800 focus:border-gray-500 focus:outline-none text-lg"
                  autoFocus
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveManual}
                  disabled={!manualValue.trim()}
                  className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold uppercase hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={goBack}
                  className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-xl py-3 font-bold text-gray-800 uppercase hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>

        {/* Regenerate Confirmation Modal */}
        {showRegenerateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md border-2 border-gray-400">
              <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Regenerate Answers?</h2>
              
              <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="text-xs text-blue-500 mb-1">New Word</div>
                <div className="text-lg font-bold text-blue-900">{pendingManualWord}</div>
              </div>
              
              <p className="text-gray-600 text-sm mb-6 text-center">
                You changed the word. Would you like to regenerate the correct answer and wrong answers to match the new word?
              </p>

              {isRegenerating && (
                <div className="mb-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Generating new answers...</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleRegenerateForWord}
                  disabled={isRegenerating}
                  className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold uppercase hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isRegenerating ? "..." : "Yes"}
                </button>
                <button
                  onClick={handleSaveWordOnly}
                  disabled={isRegenerating}
                  className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-xl py-3 font-bold text-gray-800 uppercase hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  No
                </button>
                <button
                  onClick={() => {
                    setShowRegenerateModal(false);
                    setPendingManualWord("");
                  }}
                  disabled={isRegenerating}
                  className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-xl py-3 font-bold text-gray-800 uppercase hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <div className="flex-1 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 py-6">
        {viewMode === "list" && renderListView()}
        {viewMode === "detail" && renderDetailView()}
        {viewMode === "edit-word" && renderEditWordView()}
      </div>
    </div>
  );
}
