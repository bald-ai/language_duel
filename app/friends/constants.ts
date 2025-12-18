/** Debounce delay for search input (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Maximum search results to display */
export const MAX_SEARCH_RESULTS = 20;

/** Tab identifiers */
export const TABS = {
  FRIENDS: "friends",
  REQUESTS: "requests",
  SEARCH: "search",
} as const;

export type TabId = (typeof TABS)[keyof typeof TABS];

