import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePageClient from "@/app/HomePageClient";

const routerPushMock = vi.fn();
const openSoloPracticeModalMock = vi.fn();
const openChallengeModalMock = vi.fn();
const closeSoloPracticeModalMock = vi.fn();
const handleContinueSoloPracticeMock = vi.fn();
const navigateToThemesMock = vi.fn();

let queryMock = "";
let showSoloPracticeModalMock = false;
let isSignedInMock = true;
let showExperimentalFeaturesMock = false;

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: isSignedInMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  useSearchParams: () => new URLSearchParams(queryMock),
}));

vi.mock("@/hooks/useSyncUser", () => ({
  useSyncUser: vi.fn(),
}));

vi.mock("@/app/components/auth", () => ({
  AuthButtons: ({ flash }: { flash: boolean }) => <span data-testid="auth-flash">{String(flash)}</span>,
  LeftNavButtons: () => null,
}));


vi.mock("@/hooks/useChallengeLobby", () => ({
  useChallengeLobby: () => ({
    openSoloPracticeModal: openSoloPracticeModalMock,
    openChallengeModal: openChallengeModalMock,
    closeSoloPracticeModal: closeSoloPracticeModalMock,
    handleContinueSoloPractice: handleContinueSoloPracticeMock,
    navigateToThemes: navigateToThemesMock,
    themes: [],
    showSoloPracticeModal: showSoloPracticeModalMock,
  }),
}));

vi.mock("@/app/components/BackgroundProvider", () => ({
  useBackground: () => ({
    background: "background.jpg",
    setBackground: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/hooks/ChallengeLobbyModals", () => ({
  ChallengeLobbyModals: () => null,
}));

vi.mock("@/app/components/modals/SoloPracticeModal", () => ({
  SoloPracticeModal: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close practice</button>,
}));

vi.mock("@/app/components/UserPreferencesProvider", () => ({
  useUserPreferences: () => ({
    userPreferences: {
      selectedColorSet: null,
      selectedBackground: null,
      ttsProvider: "resemble",
      showExperimentalFeatures: showExperimentalFeaturesMock,
    },
    isLoading: false,
    updateColorSet: vi.fn(),
    updateBackground: vi.fn(),
    updateTtsProvider: vi.fn(),
    updateShowExperimentalFeatures: vi.fn(),
  }),
}));

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

beforeEach(() => {
    routerPushMock.mockReset();
    openSoloPracticeModalMock.mockReset();
    openChallengeModalMock.mockReset();
    closeSoloPracticeModalMock.mockReset();
    handleContinueSoloPracticeMock.mockReset();
    navigateToThemesMock.mockReset();
    queryMock = "";
    showSoloPracticeModalMock = false;
    isSignedInMock = true;
    showExperimentalFeaturesMock = false;
  });

describe("HomePageClient", () => {
  it("hides mock feature entry points by default", () => {
    render(<HomePageClient />);

    expect(screen.getByTestId("home-solo-practice")).toBeInTheDocument();
    expect(screen.queryByTestId("home-mock-features")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-online-mock-features")).not.toBeInTheDocument();
  });

  it("shows mock feature entry points when experimental features are enabled", () => {
    showExperimentalFeaturesMock = true;

    render(<HomePageClient />);

    expect(screen.getByTestId("home-mock-features")).toBeInTheDocument();
    expect(screen.getByTestId("home-online-mock-features")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("home-mock-features"));

    expect(screen.getByTestId("home-theme-sentences")).toBeInTheDocument();
    expect(screen.getByTestId("home-mock-features-back")).toBeInTheDocument();
  });
});


it("opens authenticated destinations and returns from the experimental menu", () => {
  showExperimentalFeaturesMock = true;
  render(<HomePageClient />);
  fireEvent.click(screen.getByTestId("home-solo-practice"));
  fireEvent.click(screen.getByTestId("home-duel"));
  fireEvent.click(screen.getByTestId("home-manage-themes"));
  fireEvent.click(screen.getByTestId("home-online-mock-features"));
  expect(openSoloPracticeModalMock).toHaveBeenCalledOnce();
  expect(openChallengeModalMock).toHaveBeenCalledOnce();
  expect(routerPushMock.mock.calls).toEqual([["/themes"], ["/mock-online"]]);
  fireEvent.click(screen.getByTestId("home-mock-features"));
  fireEvent.click(screen.getByTestId("home-theme-sentences"));
  expect(routerPushMock).toHaveBeenLastCalledWith("/mocks/theme-sentences");
  fireEvent.click(screen.getByTestId("home-mock-features-back"));
  expect(screen.queryByTestId("home-solo-practice")).not.toBeNull();
});

it("flashes authentication for signed-out actions and restarts the 750ms timer on repeated clicks", () => {
  vi.useFakeTimers();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 1; });
  isSignedInMock = false;
  render(<HomePageClient />);
  fireEvent.click(screen.getByTestId("home-solo-practice"));
  expect(screen.getByTestId("auth-flash").textContent).toBe("true");
  act(() => { vi.advanceTimersByTime(500); });
  fireEvent.click(screen.getByTestId("home-duel"));
  act(() => { vi.advanceTimersByTime(749); });
  expect(screen.getByTestId("auth-flash").textContent).toBe("true");
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.getByTestId("auth-flash").textContent).toBe("false");
  expect(openSoloPracticeModalMock).not.toHaveBeenCalled();
  expect(openChallengeModalMock).not.toHaveBeenCalled();
  expect(routerPushMock).not.toHaveBeenCalled();
});

it("handles each solo deep link once, permits reopening after clearing the URL, and closes its modal", async () => {
  queryMock = "openSolo=true&themeId=theme_1&soloMode=practice_only";
  showSoloPracticeModalMock = true;
  const view = render(<HomePageClient />);
  expect(openSoloPracticeModalMock).toHaveBeenCalledOnce();
  view.rerender(<HomePageClient />);
  expect(openSoloPracticeModalMock).toHaveBeenCalledOnce();
  fireEvent.click(await screen.findByRole("button", { name: "Close practice" }));
  expect(closeSoloPracticeModalMock).toHaveBeenCalledOnce();
  queryMock = "";
  view.rerender(<HomePageClient />);
  queryMock = "openSolo=true&themeId=theme_1&soloMode=practice_only";
  view.rerender(<HomePageClient />);
  expect(openSoloPracticeModalMock).toHaveBeenCalledTimes(2);
  queryMock = "openSolo=true&themeId=theme_2";
  view.rerender(<HomePageClient />);
  expect(openSoloPracticeModalMock).toHaveBeenCalledTimes(3);
});
