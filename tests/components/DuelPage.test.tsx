import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DuelPage from "@/app/duel/[duelId]/page";
import type { Doc, Id } from "@/convex/_generated/dataModel";
const state = vi.hoisted(() => ({
  params: { duelId: "duel" } as { duelId?: string | string[] },
  user: { id: "clerk" } as { id: string } | null,
  data: undefined as unknown,
  push: vi.fn(),
  query: vi.fn(),
  session: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useParams: () => state.params,
  useRouter: () => ({ push: state.push }),
}));
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: state.user }) }));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    state.query(...args);
    return state.data;
  },
}));
vi.mock("@/app/components/ThemedPage", () => ({
  ThemedPage: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="themed-page">{children}</div>
  ),
}));
vi.mock("@/app/duel/[duelId]/DuelSession", () => ({
  default: (props: unknown) => {
    state.session(props);
    return <div data-testid="duel-session" />;
  },
}));
function data(overrides: Partial<Doc<"duels">> = {}) {
  const duel: Doc<"duels"> = {
    _id: "duel" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user" as Id<"users">,
    opponentId: "peer" as Id<"users">,
    themeIds: [],
    sourceType: "normal",
    duelMode: "pvp",
    status: "active",
    createdAt: 1,
    currentItemIndex: 0,
    itemOrder: [0],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    seed: 1,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    sessionItems: [
      {
        kind: "word",
        word: "cat",
        answer: "",
        wrongAnswers: [],
        themeId: "theme" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    duelQuestions: [
      { kind: "word", options: ["gato"], correctOption: "", difficulty: "easy", points: 1 },
    ],
    ...overrides,
  };
  return {
    duel,
    challenger: { _id: duel.challengerId, name: "Viewer" },
    opponent: { _id: duel.opponentId, name: "Peer" },
    viewerRole: "opponent",
  };
}
describe("duel page routing and access states", () => {
  beforeEach(() => {
    state.params = { duelId: "duel" };
    state.user = { id: "clerk" };
    state.data = undefined;
    state.push.mockClear();
    state.query.mockClear();
    state.session.mockClear();
  });
  it.each([undefined, ["duel", "extra"]])(
    "rejects an invalid route value %j and skips the query",
    (duelId) => {
      state.params = { duelId };
      render(<DuelPage />);
      expect(screen.getByText("Invalid duel link.")).toBeInTheDocument();
      expect(state.query.mock.calls[0][1]).toBe("skip");
      expect(state.session).not.toHaveBeenCalled();
    },
  );
  it("asks signed-out viewers to sign in", () => {
    state.user = null;
    render(<DuelPage />);
    expect(screen.getByText("Sign in first.")).toBeInTheDocument();
    expect(state.session).not.toHaveBeenCalled();
  });
  it("renders loading before the query resolves", () => {
    render(<DuelPage />);
    expect(screen.getByText("Loading duel...")).toBeInTheDocument();
    expect(state.query.mock.calls[0][1]).toEqual({ duelId: "duel" });
  });
  it("renders denied membership without mounting a session", () => {
    state.data = null;
    render(<DuelPage />);
    expect(
      screen.getByText("You're not part of this duel"),
    ).toBeInTheDocument();
    expect(state.session).not.toHaveBeenCalled();
  });
  it.each([
    [{ sessionItems: [] }, "Missing session content."],
    [{ duelQuestions: [] }, "Missing duel questions."],
    [{ duelQuestions: undefined }, "Missing duel questions."],
  ] as const)("reports incomplete session data %j", (override, message) => {
    state.data = data(override as Partial<Doc<"duels">>);
    render(<DuelPage />);
    expect(
      screen.getByText(`Duel data is incomplete. ${message}`),
    ).toBeInTheDocument();
    expect(state.session).not.toHaveBeenCalled();
  });
  it("passes player summaries and the server viewer role into a valid session", () => {
    state.data = data();
    render(<DuelPage />);
    expect(screen.getByTestId("duel-session")).toBeInTheDocument();
    expect(state.session).toHaveBeenCalledWith(state.data);
    expect(state.push).not.toHaveBeenCalled();
  });
  it("allows relay DTOs to omit precomputed questions and preserves absent player summaries", () => {
    const dto = {
      ...data({ duelMode: "relay", duelQuestions: undefined }),
      challenger: null,
      opponent: null,
    };
    state.data = dto;
    render(<DuelPage />);
    expect(state.session).toHaveBeenCalledWith(dto);
  });
  it("redirects a stopped duel and displays the redirect state", () => {
    state.data = data({ status: "stopped" });
    render(<DuelPage />);
    expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    expect(state.push).toHaveBeenCalledWith("/");
    expect(state.session).not.toHaveBeenCalled();
  });
});
