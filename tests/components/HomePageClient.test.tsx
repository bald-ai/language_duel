import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePageClient from "@/app/HomePageClient";

const routerPushMock = vi.fn();
const openSoloPracticeModalMock = vi.fn();
const openChallengeModalMock = vi.fn();
const closeSoloPracticeModalMock = vi.fn();
const handleContinueSoloPracticeMock = vi.fn();
const navigateToThemesMock = vi.fn();

let isSignedInMock = true;
let showExperimentalFeaturesMock = false;

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: isSignedInMock }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useSyncUser", () => ({
  useSyncUser: vi.fn(),
}));

vi.mock("@/app/components/auth", () => ({
  AuthButtons: () => null,
  LeftNavButtons: () => null,
}));

vi.mock("@/hooks/useSoloDeepLink", () => ({
  useSoloDeepLink: () => ({
    soloThemeIds: null,
    soloInitialMode: null,
    soloDeepLinkKey: null,
  }),
}));

vi.mock("@/hooks/useChallengeLobby", () => ({
  useChallengeLobby: () => ({
    openSoloPracticeModal: openSoloPracticeModalMock,
    openChallengeModal: openChallengeModalMock,
    closeSoloPracticeModal: closeSoloPracticeModalMock,
    handleContinueSoloPractice: handleContinueSoloPracticeMock,
    navigateToThemes: navigateToThemesMock,
    themes: [],
    showSoloPracticeModal: false,
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
  SoloPracticeModal: () => null,
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

describe("HomePageClient", () => {
  beforeEach(() => {
    routerPushMock.mockReset();
    openSoloPracticeModalMock.mockReset();
    openChallengeModalMock.mockReset();
    closeSoloPracticeModalMock.mockReset();
    handleContinueSoloPracticeMock.mockReset();
    navigateToThemesMock.mockReset();
    isSignedInMock = true;
    showExperimentalFeaturesMock = false;
  });

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
