/** Both word and sentence review preserve the original generation order. */
export type IndexedReviewItem = { id: string; originalIndex: number };

type ReviewItems<T extends IndexedReviewItem> = {
  activeItems: T[];
  removedItems: T[];
};

export function sortReviewItems<T extends IndexedReviewItem>(items: T[]): T[] {
  return [...items].sort((left, right) => left.originalIndex - right.originalIndex);
}

/** A repeated remove/restore is a no-op, including the state object identity. */
export function moveReviewItem<T extends IndexedReviewItem, S extends ReviewItems<T>>(
  state: S,
  id: string,
  restore: boolean
): S {
  const sourceKey = restore ? "removedItems" : "activeItems";
  const targetKey = restore ? "activeItems" : "removedItems";
  const item = state[sourceKey].find((entry) => entry.id === id);
  if (!item) return state;
  return {
    ...state,
    [sourceKey]: state[sourceKey].filter((entry) => entry.id !== id),
    [targetKey]: sortReviewItems([...state[targetKey], item]),
  };
}
