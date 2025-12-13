"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ThemeColorPicker from "../components/ThemeColorPicker";

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
  wordType?: "nouns" | "verbs";
  bgColor?: string;
  titleColor?: string;
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
- Each word needs exactly 6 wrong answers (Spanish)
- Wrong answers must be CHALLENGING and tricky (can include grammar mistakes)
- All 20 words must be unique within this theme`;
  } else if (type === "word") {
    const existingWordsList = existingWords && existingWords.length > 0
      ? existingWords.join(", ")
      : "(none)";
    
    const rejectedWordsList = rejectedWords && rejectedWords.length > 0
      ? `\n\nREJECTED SUGGESTIONS (DO NOT REPEAT): ${rejectedWords.join(", ")}`
      : "";
    
    prompt = `SYSTEM: You generate vocabulary flashcards. Given a theme, you produce an English word with its correct Spanish translation and 6 challenging wrong Spanish answers.

TASK: Replace "${currentWord}" with a NEW English word for the theme "${themeName}".

EXISTING WORDS (DO NOT DUPLICATE): ${existingWordsList}${rejectedWordsList}

REQUIREMENTS:
- New word must be a different English noun fitting the theme
- Must NOT duplicate any existing word or rejected suggestion
- Include correct Spanish translation
- Include 6 tricky wrong Spanish answers (similar-sounding, subtle differences, plausible mistakes)`;
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
  const duplicateThemeMutation = useMutation(api.themes.duplicateTheme);
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [localWords, setLocalWords] = useState<WordEntry[]>([]); // Local edits before save
  
  // Generate new theme state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemePrompt, setNewThemePrompt] = useState("");
  const [wordType, setWordType] = useState<"nouns" | "verbs">("nouns");
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
  
  // Theme name editing state
  const [isEditingThemeName, setIsEditingThemeName] = useState(false);
  const [editedThemeName, setEditedThemeName] = useState("");

  // Theme style picker state (detail view)
  const [isThemeStyleOpen, setIsThemeStyleOpen] = useState(false);
  const [draftBgColor, setDraftBgColor] = useState<string | undefined>(undefined);
  const [draftTitleColor, setDraftTitleColor] = useState<string | undefined>(undefined);
  const [themeStyleTab, setThemeStyleTab] = useState<"bg" | "title">("bg");
  const stylePopoverRef = useRef<HTMLDivElement | null>(null);
  const styleButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close popover on outside click / Escape
  useEffect(() => {
    if (!isThemeStyleOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (stylePopoverRef.current?.contains(t)) return;
      if (styleButtonRef.current?.contains(t)) return;
      setIsThemeStyleOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsThemeStyleOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isThemeStyleOpen]);
  
  // Add new word state
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newWordInput, setNewWordInput] = useState("");
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [addWordError, setAddWordError] = useState<string | null>(null);
  
  // Generate random words state
  const [showGenerateRandomModal, setShowGenerateRandomModal] = useState(false);
  const [randomWordCount, setRandomWordCount] = useState(5);
  const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);
  const [generateRandomError, setGenerateRandomError] = useState<string | null>(null);

  // Delete word actions
  const deleteWord = (index: number) => {
    const word = localWords[index];
    if (confirm(`Delete word "${word.word}"?`)) {
      // Remove the word from localWords
      const updatedWords = localWords.filter((_, idx) => idx !== index);
      setLocalWords(updatedWords);
    }
  };

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
      setIsEditingThemeName(false);
      setEditedThemeName("");
      setIsThemeStyleOpen(false);
      setDraftBgColor(undefined);
      setDraftTitleColor(undefined);
    } else {
      router.push("/");
    }
  };

  // Theme actions
  const openTheme = (theme: Theme) => {
    setSelectedTheme(theme);
    setLocalWords([...theme.words]);
    setDraftBgColor(theme.bgColor);
    setDraftTitleColor(theme.titleColor);
    setIsThemeStyleOpen(false);
    setThemeStyleTab("bg");
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

  const handleDuplicateTheme = async (themeId: Id<"themes">) => {
    try {
      await duplicateThemeMutation({ themeId });
    } catch (error) {
      console.error("Failed to duplicate theme:", error);
      alert("Failed to duplicate theme");
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
          themePrompt: newThemePrompt.trim() || undefined,
          wordType,
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
        wordType,
      });
      
      setShowGenerateModal(false);
      setNewThemeName("");
      setNewThemePrompt("");
      setWordType("nouns");
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
          wordType: selectedTheme.wordType || "nouns",
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
          wordType: selectedTheme.wordType || "nouns",
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

  // Check if a word already exists in the theme (case-insensitive)
  const isWordDuplicate = (word: string): boolean => {
    const normalizedWord = word.toLowerCase().trim();
    return localWords.some(w => w.word.toLowerCase().trim() === normalizedWord);
  };

  // Handle adding a new word to the theme
  const handleAddWord = async () => {
    if (!selectedTheme || !newWordInput.trim()) return;
    
    const trimmedWord = newWordInput.trim();
    
    // Check for duplicate
    if (isWordDuplicate(trimmedWord)) {
      setAddWordError(`"${trimmedWord}" already exists in this theme`);
      return;
    }
    
    setIsAddingWord(true);
    setAddWordError(null);
    
    try {
      const existingWords = localWords.map(w => w.word);
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "add-word",
          themeName: selectedTheme.name,
          wordType: selectedTheme.wordType || "nouns",
          newWord: trimmedWord,
          existingWords,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to generate word");
      }
      
      // Add the new word to localWords
      setLocalWords([...localWords, data.data]);
      
      // Close modal and reset
      setShowAddWordModal(false);
      setNewWordInput("");
    } catch (error) {
      console.error("Add word error:", error);
      setAddWordError(error instanceof Error ? error.message : "Failed to add word");
    } finally {
      setIsAddingWord(false);
    }
  };

  // Handle generating random words for the theme
  const handleGenerateRandomWords = async () => {
    if (!selectedTheme) return;
    
    setIsGeneratingRandom(true);
    setGenerateRandomError(null);
    
    try {
      const existingWords = localWords.map(w => w.word);
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate-random-words",
          themeName: selectedTheme.name,
          wordType: selectedTheme.wordType || "nouns",
          count: randomWordCount,
          existingWords,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to generate words");
      }
      
      // Add all generated words to localWords
      setLocalWords([...localWords, ...data.data]);
      
      // Close modal and reset
      setShowGenerateRandomModal(false);
      setRandomWordCount(5);
    } catch (error) {
      console.error("Generate random words error:", error);
      setGenerateRandomError(error instanceof Error ? error.message : "Failed to generate words");
    } finally {
      setIsGeneratingRandom(false);
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
        name: selectedTheme.name.toUpperCase(),
        bgColor: draftBgColor ?? selectedTheme.bgColor,
        titleColor: draftTitleColor ?? selectedTheme.titleColor,
        words: localWords,
      });
      setViewMode("list");
      setSelectedTheme(null);
      setLocalWords([]);
      setIsThemeStyleOpen(false);
      setDraftBgColor(undefined);
      setDraftTitleColor(undefined);
    } catch (error) {
      console.error("Failed to save theme:", error);
      alert("Failed to save theme");
    }
  };

  const handleCancelTheme = () => {
    setViewMode("list");
    setSelectedTheme(null);
    setLocalWords([]);
    setIsThemeStyleOpen(false);
    setDraftBgColor(undefined);
    setDraftTitleColor(undefined);
  };

  
  // Render theme list view
  const renderListView = () => (
    <>
      <header className="w-full mb-6">
        <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4 mb-4">
          <h1 className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide">
            Themes
          </h1>
        </div>
        
        {/* Generate New Button */}
        <button
          onClick={() => setShowGenerateModal(true)}
          className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 text-lg font-bold text-white uppercase tracking-wide hover:bg-gray-700 transition-colors"
        >
          Generate New
        </button>
      </header>

      {/* Themes List */}
      <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 mb-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {themes.map((theme) => (
            <div
              key={theme._id}
              className="w-full p-4 bg-gray-800/50 border-2 border-gray-700 rounded-xl hover:border-gray-600 transition-colors overflow-hidden"
              style={{ backgroundColor: (theme as Theme).bgColor ?? undefined }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  onClick={() => openTheme(theme as Theme)}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="font-bold text-lg truncate"
                      style={{ color: (theme as Theme).titleColor ?? "#e5e7eb" }}
                      title={theme.name}
                    >
                      {theme.name}
                    </span>
                    {checkThemeForDuplicateWords(theme.words) && (
                      <span className="text-red-500 text-xl font-bold shrink-0" title="This theme has duplicate words">!</span>
                    )}
                    {checkThemeForDuplicateWrongAnswers(theme.words) && (
                      <span className="text-orange-500 text-xl font-bold shrink-0" title="This theme has duplicate wrong answers">⚠</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 truncate" title={`${theme.words.length} words`}>
                    {theme.words.length} words
                  </div>
                </button>
                <div className="flex flex-col items-end gap-2 ml-auto">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => handleDuplicateTheme(theme._id)}
                      className="px-3 py-1 bg-blue-500/15 text-blue-200 rounded-lg text-sm font-medium hover:bg-blue-500/25 transition-colors whitespace-nowrap"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDeleteTheme(theme._id)}
                      className="px-3 py-1 bg-red-500/15 text-red-200 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-colors whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>

                  <div
                    className="px-2 py-1 rounded-md border border-gray-700 bg-gray-800 text-[11px] font-semibold tracking-wide text-gray-300 uppercase leading-none whitespace-nowrap"
                    title="Word type"
                  >
                    {(theme as Theme).wordType === "verbs" ? "Verbs" : "Nouns"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={goBack}
        className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl py-4 text-xl font-bold text-white uppercase tracking-wide hover:bg-gray-700 transition-colors"
      >
        Back
      </button>

      {/* Generate New Theme Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4 text-center">New Theme</h2>
            
            {/* Word Type Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setWordType("nouns")}
                disabled={isGenerating}
                className={`flex-1 py-3 rounded-xl font-bold uppercase transition-colors ${
                  wordType === "nouns"
                    ? "bg-gray-700 text-white"
                    : "bg-gray-800 border-2 border-gray-700 text-gray-200 hover:bg-gray-700"
                }`}
              >
                Nouns
              </button>
              <button
                onClick={() => setWordType("verbs")}
                disabled={isGenerating}
                className={`flex-1 py-3 rounded-xl font-bold uppercase transition-colors ${
                  wordType === "verbs"
                    ? "bg-gray-700 text-white"
                    : "bg-gray-800 border-2 border-gray-700 text-gray-200 hover:bg-gray-700"
                }`}
              >
                Verbs
              </button>
            </div>
            
            <div className="mb-6 space-y-4">
              <div>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => {
                    if (e.target.value.length <= 25) {
                      setNewThemeName(e.target.value);
                    }
                  }}
                  placeholder="Theme name (e.g. Kitchen)"
                  maxLength={25}
                  className="w-full p-4 border-2 border-gray-700 bg-gray-900 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  disabled={isGenerating}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {newThemeName.length}/25
                </p>
              </div>
              
              <div>
                <textarea
                  value={newThemePrompt}
                  onChange={(e) => {
                    if (e.target.value.length <= 250) {
                      setNewThemePrompt(e.target.value);
                    }
                  }}
                  placeholder="Optional: Specify details (e.g. small items)"
                  maxLength={250}
                  rows={2}
                  className="w-full p-4 border-2 border-gray-700 bg-gray-900 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                  disabled={isGenerating}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {newThemePrompt.length}/250
                </p>
              </div>
              
            </div>

            {generateError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm">
                {generateError}
              </div>
            )}

            {isGenerating && (
              <div className="mb-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm text-gray-300">Generating 20 words... This may take a moment.</p>
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
                  setNewThemePrompt("");
                  setWordType("nouns");
                  setGenerateError(null);
                }}
                disabled={isGenerating}
                className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
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

    const effectiveTitleColor = draftTitleColor ?? selectedTheme.titleColor;

    return (
      <div className="fixed inset-0 flex flex-col bg-gray-900">
        {/* Fixed Header */}
        <header className="flex-shrink-0 w-full max-w-md mx-auto px-4 pt-6 pb-4">
          <div className="relative w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 pl-4 pr-12">
            {isEditingThemeName ? (
              <input
                type="text"
                value={editedThemeName}
                onChange={(e) => {
                  if (e.target.value.length <= 25) {
                    setEditedThemeName(e.target.value.toUpperCase());
                  }
                }}
                onBlur={() => {
                  if (editedThemeName.trim() && editedThemeName.trim().toUpperCase() !== selectedTheme.name) {
                    setSelectedTheme({ ...selectedTheme, name: editedThemeName.trim().toUpperCase() });
                  }
                  setIsEditingThemeName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (editedThemeName.trim() && editedThemeName.trim().toUpperCase() !== selectedTheme.name) {
                      setSelectedTheme({ ...selectedTheme, name: editedThemeName.trim().toUpperCase() });
                    }
                    setIsEditingThemeName(false);
                  } else if (e.key === "Escape") {
                    setIsEditingThemeName(false);
                  }
                }}
                maxLength={25}
                className="w-full text-xl font-bold text-center text-gray-300 uppercase tracking-wide bg-transparent border-none outline-none focus:ring-0"
                style={{ color: effectiveTitleColor ?? undefined }}
                autoFocus
              />
            ) : (
              <h1
                onClick={() => {
                  setEditedThemeName(selectedTheme.name);
                  setIsEditingThemeName(true);
                }}
                className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide cursor-pointer transition-colors"
                style={{ color: effectiveTitleColor ?? undefined }}
                title="Click to edit theme name"
              >
                {selectedTheme.name}
              </h1>
            )}

            {/* Settings wheel */}
            <button
              ref={styleButtonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsThemeStyleOpen((v) => !v);
              }}
              className="absolute right-2 top-2 rounded-lg border-2 border-gray-700 bg-gray-800 p-2 text-gray-300 hover:bg-gray-700 transition-colors"
              aria-label="Theme settings"
              title="Theme settings"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19.4 15a7.97 7.97 0 0 0 .1-1 7.97 7.97 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8.3 8.3 0 0 0-1.7-1L15 2h-6l-.9 3a8.3 8.3 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.97 7.97 0 0 0-.1 1c0 .34.03.67.1 1l-2 1.5 2 3.5 2.4-1a8.3 8.3 0 0 0 1.7 1l.9 3h6l.9-3a8.3 8.3 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Popover */}
            {isThemeStyleOpen && (
              <div
                ref={stylePopoverRef}
                className="absolute right-2 top-full z-50 mt-2 w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-gray-700 bg-gray-800 p-2 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-gray-300">
                    Theme style
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsThemeStyleOpen(false)}
                    className="rounded-lg border border-gray-600 bg-gray-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-gray-600 transition-colors"
                    title="Close"
                  >
                    Close
                  </button>
                </div>

                <div className="mb-2 grid grid-cols-2 gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => setThemeStyleTab("bg")}
                    className={`rounded-xl border-2 py-2 text-xs font-bold uppercase ${
                      themeStyleTab === "bg"
                        ? "border-gray-700 bg-gray-900 text-white"
                        : "border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600"
                    }`}
                  >
                    Background
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeStyleTab("title")}
                    className={`rounded-xl border-2 py-2 text-xs font-bold uppercase ${
                      themeStyleTab === "title"
                        ? "border-gray-700 bg-gray-900 text-white"
                        : "border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600"
                    }`}
                  >
                    Font
                  </button>
                </div>

                <div className="max-h-[65vh] overflow-y-auto px-1 pb-1">
                  {themeStyleTab === "bg" ? (
                    <ThemeColorPicker
                      compact
                      label="Background (list card)"
                      value={draftBgColor ?? selectedTheme.bgColor}
                      onChange={(hex) => setDraftBgColor(hex)}
                    />
                  ) : (
                    <ThemeColorPicker
                      compact
                      label="Font (theme title)"
                      value={draftTitleColor ?? selectedTheme.titleColor}
                      onChange={(hex) => setDraftTitleColor(hex)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Words List */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-4">
              <div className="flex flex-col gap-4">
                {localWords.map((word, index) => (
                  <div
                    key={index}
                    className="bg-gray-800/50 border-2 border-gray-700 rounded-xl p-4"
                  >
                    {/* Word number - red if duplicate word, orange if duplicate wrong answers */}
                    <div className="flex items-center gap-2 mb-3">
                      {(() => {
                        const duplicateWordIndices = getDuplicateWordIndices(localWords);
                        const isDuplicateWord = duplicateWordIndices.has(index);
                        const hasDuplicateWrongAnswers = new Set(word.wrongAnswers).size !== word.wrongAnswers.length;
                        
                        let badgeClass = "border-gray-600 text-gray-300 bg-gray-800";
                        if (isDuplicateWord) {
                          badgeClass = "border-red-500 text-red-200 bg-red-500/10";
                        } else if (hasDuplicateWrongAnswers) {
                          badgeClass = "border-orange-500 text-orange-200 bg-orange-500/10";
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
                        className="p-2 bg-blue-500/10 border-2 border-blue-500/30 rounded-lg text-sm font-medium text-blue-200 hover:bg-blue-500/20 hover:border-blue-400/50 transition-colors text-center"
                      >
                        <div className="text-xs text-blue-300 mb-1">Word</div>
                        {word.word}
                      </button>
                      <button
                        onClick={() => startEditWord(index, "answer")}
                        className="p-2 bg-green-500/10 border-2 border-green-500/30 rounded-lg text-sm font-medium text-green-200 hover:bg-green-500/20 hover:border-green-400/50 transition-colors text-center"
                      >
                        <div className="text-xs text-green-300 mb-1">Answer</div>
                        {word.answer}
                      </button>
                    </div>

                    {/* Wrong Answers Grid - Orange/Red tones (3 columns for 6 answers) */}
                    <div className="grid grid-cols-3 gap-2">
                      {word.wrongAnswers.map((wrongAnswer, wrongIdx) => (
                        <button
                          key={wrongIdx}
                          onClick={() => startEditWord(index, "wrong", wrongIdx)}
                          className="p-2 bg-orange-500/10 border-2 border-orange-500/30 rounded-lg text-sm font-medium text-orange-200 hover:bg-orange-500/20 hover:border-orange-400/50 transition-colors text-center"
                        >
                          <div className="text-xs text-orange-300 mb-1">Wrong {wrongIdx + 1}</div>
                          {wrongAnswer}
                        </button>
                      ))}
                    </div>

                    {/* Delete Word Button */}
                    <button
                      onClick={() => deleteWord(index)}
                      className="mt-3 w-full py-2 bg-red-500/10 border-2 border-red-500/30 rounded-lg text-sm font-medium text-red-200 hover:bg-red-500/20 hover:border-red-400/50 transition-colors"
                    >
                      Delete Word
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Bottom spacer for fixed footer */}
            <div className="h-36"></div>
          </div>
        </div>

        {/* Fixed Bottom Buttons */}
        <div className="flex-shrink-0 w-full bg-gray-900 border-t border-gray-800 px-4 py-4">
          <div className="w-full max-w-md mx-auto space-y-3">
            {/* Add Word / Generate Random Row */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddWordModal(true)}
                className="flex-1 bg-blue-600 text-white rounded-2xl py-3 text-lg font-bold uppercase hover:bg-blue-700 transition-colors"
              >
                + Add Word
              </button>
              <button
                onClick={() => setShowGenerateRandomModal(true)}
                className="flex-1 bg-purple-600 text-white rounded-2xl py-3 text-lg font-bold uppercase hover:bg-purple-700 transition-colors"
              >
                + Generate
              </button>
            </div>
            
            {/* Save/Cancel Row */}
            <div className="flex gap-3">
              <button
                onClick={handleSaveTheme}
                className="flex-1 bg-gray-800 text-white rounded-2xl py-4 text-lg font-bold uppercase hover:bg-gray-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancelTheme}
                className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-2xl py-4 text-lg font-bold text-white uppercase hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Add Word Modal */}
        {showAddWordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 text-center">Add New Word</h2>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">English Word</label>
                <input
                  type="text"
                  value={newWordInput}
                  onChange={(e) => {
                    setNewWordInput(e.target.value);
                    setAddWordError(null); // Clear error on input change
                  }}
                  placeholder="Enter an English word..."
                  className="w-full p-4 border-2 border-gray-700 bg-gray-900 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  disabled={isAddingWord}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newWordInput.trim()) {
                      handleAddWord();
                    }
                  }}
                />
              </div>

              {addWordError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm">
                  {addWordError}
                </div>
              )}

              {isAddingWord && (
                <div className="mb-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm text-gray-300">Generating Spanish translation and wrong answers...</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAddWord}
                  disabled={!newWordInput.trim() || isAddingWord}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold uppercase disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                >
                  {isAddingWord ? "Adding..." : "Add"}
                </button>
                <button
                  onClick={() => {
                    setShowAddWordModal(false);
                    setNewWordInput("");
                    setAddWordError(null);
                  }}
                  disabled={isAddingWord}
                  className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generate Random Words Modal */}
        {showGenerateRandomModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 text-center">Generate Random Words</h2>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">Number of words to generate (1-10)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={randomWordCount}
                    onChange={(e) => setRandomWordCount(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    disabled={isGeneratingRandom}
                  />
                  <span className="w-8 text-center text-xl font-bold text-white">{randomWordCount}</span>
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-4 text-center">
                This will generate {randomWordCount} new unique word{randomWordCount > 1 ? 's' : ''} for the theme &quot;{selectedTheme?.name}&quot;
              </p>

              {generateRandomError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm">
                  {generateRandomError}
                </div>
              )}

              {isGeneratingRandom && (
                <div className="mb-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm text-gray-300">Generating {randomWordCount} words... This may take a moment.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleGenerateRandomWords}
                  disabled={isGeneratingRandom}
                  className="flex-1 bg-purple-600 text-white rounded-xl py-3 font-bold uppercase disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
                >
                  {isGeneratingRandom ? "Generating..." : "Generate"}
                </button>
                <button
                  onClick={() => {
                    setShowGenerateRandomModal(false);
                    setRandomWordCount(5);
                    setGenerateRandomError(null);
                  }}
                  disabled={isGeneratingRandom}
                  className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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
          <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4">
            <h1 className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide">
              Edit {fieldLabel}
            </h1>
          </div>
        </header>

        <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 mb-4 flex-1 overflow-auto">
          {/* Current Value Display */}
          <div className="mb-4 p-3 bg-gray-900 border-2 border-gray-700 rounded-xl">
            <div className="text-xs text-gray-400 mb-1">Current Value</div>
            <div className="text-lg font-bold text-white">{oldValue}</div>
          </div>

          {/* Raw Prompt Display - hide for answer manual edit */}
          {!(editingField === "answer" && editMode === "manual") && (
            <div className="mb-4">
              <div className="text-xs text-gray-400 mb-1">Prompt (editable for feedback)</div>
              <textarea
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                className="w-full p-3 border-2 border-gray-700 bg-gray-900 rounded-xl text-gray-200 font-mono text-xs focus:border-blue-500 focus:outline-none resize-none"
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
                className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors"
              >
                Manually
              </button>
              <button
                onClick={goBack}
                className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors"
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
                <div className="p-3 bg-gray-900 border-2 border-gray-700 rounded-xl">
                  <div className="text-xs text-gray-400 mb-1">Old {fieldLabel}</div>
                  <div className="text-lg font-bold text-white">{oldValue}</div>
                </div>
                <div className="p-3 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                  <div className="text-xs text-green-300 mb-1">New {fieldLabel}</div>
                  <div className="text-lg font-bold text-green-200">{generatedValue}</div>
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
                  className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors"
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
                <div className="text-sm text-gray-300 mb-2">Enter new value:</div>
                <input
                  type="text"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  className="w-full p-4 border-2 border-gray-700 bg-gray-900 rounded-xl text-white focus:border-blue-500 focus:outline-none text-lg"
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
                  className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors"
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
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 text-center">Regenerate Answers?</h2>
              
              <div className="mb-4 p-3 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl">
                <div className="text-xs text-blue-300 mb-1">New Word</div>
                <div className="text-lg font-bold text-blue-200">{pendingManualWord}</div>
              </div>
              
              <p className="text-gray-300 text-sm mb-6 text-center">
                You changed the word. Would you like to regenerate the correct answer and wrong answers to match the new word?
              </p>

              {isRegenerating && (
                <div className="mb-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm text-gray-300">Generating new answers...</p>
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
                  className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  No
                </button>
                <button
                  onClick={() => {
                    setShowRegenerateModal(false);
                    setPendingManualWord("");
                  }}
                  disabled={isRegenerating}
                  className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
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
    <div className="min-h-screen flex flex-col bg-gray-900">
      <div className="flex-1 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 py-6">
        {viewMode === "list" && renderListView()}
        {viewMode === "detail" && renderDetailView()}
        {viewMode === "edit-word" && renderEditWordView()}
      </div>
    </div>
  );
}
