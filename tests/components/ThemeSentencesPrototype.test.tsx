import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import ThemeSentencesMockPage from "@/app/mocks/theme-sentences/page";
import { MOCK_THEMES } from "@/app/mocks/theme-sentences/mockThemes";
import type { GeneratedSentence } from "@/app/api/mocks/theme-sentences/route";
vi.mock("@/app/components/ThemedPage", () => ({ ThemedPage: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
const fetchMock = vi.fn();
const sentences: GeneratedSentence[] = [
  { englishPrompt: "I eat bread", words: [{ es: "Yo", en: "I", themeWord: "" }, { es: "como", en: "eat", themeWord: "comer" }, { es: "pan", en: "bread", themeWord: "pan" }], distractors: ["perro", "gato", "azul"] },
  { englishPrompt: "I travel by train", words: [{ es: "Viajo", en: "I travel", themeWord: "viajar" }, { es: "en", en: "by", themeWord: "" }, { es: "tren", en: "train", themeWord: "tren" }], distractors: ["verde", "casa", "duerme"] },
];
beforeEach(() => { fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ success: true, sentences }))); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
async function generate() { fireEvent.click(screen.getByRole("button", { name: "Generate Sentences" })); await screen.findByRole("heading", { name: "Review Generated Sentences" }); }
describe("sentence generation prototype workflow", () => {
  it("requires a selected theme and sends twice the chosen round target with only selected vocabulary", async () => {
    render(<ThemeSentencesMockPage />);
    fireEvent.click(screen.getByRole("button", { name: /Food & Drink/ })); fireEvent.click(screen.getByRole("button", { name: /Travel/ }));
    expect((screen.getByRole("button", { name: "Generate Sentences" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Family/ })); fireEvent.click(screen.getByRole("button", { name: "3" }));
    await generate();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const family = MOCK_THEMES.find(theme => theme.id === "family")!;
    expect(url).toBe("/api/mocks/theme-sentences"); expect(request.method).toBe("POST");
    expect(JSON.parse(request.body as string)).toEqual({ themes: [{ name: family.name, words: family.words }], sentenceCount: 6 });
  });
  it("locks generation while the mocked HTTP response is pending", async () => {
    let resolve!: (response: Response) => void; fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; })); render(<ThemeSentencesMockPage />);
    fireEvent.click(screen.getByRole("button", { name: "8" })); fireEvent.click(screen.getByRole("button", { name: "Generate Sentences" }));
    expect((screen.getByRole("button", { name: "Generating…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve(new Response(JSON.stringify({ success: true, sentences }))));
    expect(screen.getByRole("heading", { name: "Review Generated Sentences" })).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sentenceCount).toBe(16);
  });
  it("removes, restores, and previews only kept sentences with theme translations hidden until revealed", async () => {
    render(<ThemeSentencesMockPage />); await generate();
    fireEvent.click(screen.getByRole("button", { name: /Removed \(0\)/ })); expect(screen.getByText("Removed sentences will appear here.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Removed \(0\)/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    expect(screen.getByText("Active: 1")).toBeInTheDocument(); expect(screen.getByText("Removed: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Removed \(1\)/ })); fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByText("Active: 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue with 2 sentences" }));
    expect(screen.getByRole("heading", { name: "Theme Preview — 2 Rounds" })).toBeInTheDocument();
    expect(screen.getByText("bread").style.visibility).toBe("hidden"); expect(screen.getByText("I", { exact: true }).style.visibility).toBe("visible");
    expect(screen.getByText(/Theme word coverage — 4 of 16 words used/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Reveal theme-word translations" })); expect(screen.getByText("bread").style.visibility).toBe("visible");
    fireEvent.click(screen.getByRole("button", { name: "Back to review" })); fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Continue with 1 sentence" }));
    expect(screen.queryByText("“I travel by train”")).toBeNull(); expect(screen.getByText(/Theme word coverage — 2 of 16 words used/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start over" })); expect(screen.getByRole("heading", { name: "Generate From Themes" })).toBeInTheDocument();
  });
  it("prevents an empty selection from continuing and can cancel the review", async () => {
    render(<ThemeSentencesMockPage />); await generate();
    for (const button of screen.getAllByRole("button", { name: "Remove" })) fireEvent.click(button);
    expect(screen.getByText("No sentences selected. Restore at least one to continue.")).toBeInTheDocument();
    expect((screen.getByRole("button", { name: "Continue with 0 sentences" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(screen.getByRole("heading", { name: "Generate From Themes" })).toBeInTheDocument();
  });
  it.each([[{ success: false, error: "Service unavailable" }, "Service unavailable"], [{ success: false }, "Generation failed"]])("reports the API failure %j and allows another request", async (payload, message) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload))); render(<ThemeSentencesMockPage />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Sentences" })); await waitFor(() => expect(screen.queryByText(message as string)).not.toBeNull());
    expect(screen.getByRole("button", { name: "Generate Sentences" })).toBeEnabled(); await generate(); expect(screen.queryByText(message as string)).toBeNull();
  });
  it("reports a rejected request without leaving the setup screen", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection failed")); render(<ThemeSentencesMockPage />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Sentences" })); await screen.findByText("Connection failed");
    expect(screen.getByRole("heading", { name: "Generate From Themes" })).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Generate Sentences" })).toBeEnabled();
  });
});
