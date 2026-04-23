import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type CtxWithDb = QueryCtx | MutationCtx;
type WordWithOptionalTts = { ttsStorageId?: Id<"_storage"> };

function getStorageApi(ctx: MutationCtx): { delete: (id: Id<"_storage">) => Promise<void> } | null {
  const storage = (ctx as MutationCtx & {
    storage?: { delete: (id: Id<"_storage">) => Promise<void> };
  }).storage;

  return storage ?? null;
}

export function collectTtsStorageIds(
  words: WordWithOptionalTts[]
): Set<Id<"_storage">> {
  const storageIds = new Set<Id<"_storage">>();

  for (const word of words) {
    if (word.ttsStorageId) {
      storageIds.add(word.ttsStorageId);
    }
  }

  return storageIds;
}

export async function getSnapshotReferencedStorageIdsForTheme(
  ctx: CtxWithDb,
  themeId: Id<"themes">
): Promise<Set<Id<"_storage">>> {
  const snapshots = await ctx.db
    .query("weeklyGoalThemeSnapshots")
    .withIndex("by_originalTheme", (q) => q.eq("originalThemeId", themeId))
    .collect();

  const referencedStorageIds = new Set<Id<"_storage">>();

  for (const snapshot of snapshots) {
    const snapshotStorageIds = collectTtsStorageIds(
      snapshot.words as Doc<"themes">["words"]
    );
    for (const storageId of snapshotStorageIds) {
      referencedStorageIds.add(storageId);
    }
  }

  return referencedStorageIds;
}

async function getActiveReferencedStorageIdsForTheme(
  ctx: CtxWithDb,
  themeId: Id<"themes">
): Promise<Set<Id<"_storage">>> {
  const referencedStorageIds = await getSnapshotReferencedStorageIdsForTheme(
    ctx,
    themeId
  );
  const liveTheme = await ctx.db.get(themeId);

  if (liveTheme) {
    const liveStorageIds = collectTtsStorageIds(
      liveTheme.words as Doc<"themes">["words"]
    );
    for (const storageId of liveStorageIds) {
      referencedStorageIds.add(storageId);
    }
  }

  return referencedStorageIds;
}

export async function deleteStorageIdsSafely(
  ctx: MutationCtx,
  storageIds: Iterable<Id<"_storage">>,
  errorLabel: string
): Promise<void> {
  const storage = getStorageApi(ctx);
  if (!storage) {
    return;
  }

  const uniqueStorageIds = Array.from(new Set(storageIds));
  if (uniqueStorageIds.length === 0) {
    return;
  }

  await Promise.all(
    uniqueStorageIds.map(async (storageId) => {
      try {
        await storage.delete(storageId);
      } catch (error) {
        console.error(errorLabel, storageId, error);
      }
    })
  );
}

export async function deleteUnreferencedStorageIdsForTheme(
  ctx: MutationCtx,
  themeId: Id<"themes">,
  candidateStorageIds: Iterable<Id<"_storage">>,
  errorLabel: string
): Promise<void> {
  const uniqueCandidateStorageIds = Array.from(new Set(candidateStorageIds));
  if (uniqueCandidateStorageIds.length === 0) {
    return;
  }

  const referencedStorageIds = await getActiveReferencedStorageIdsForTheme(
    ctx,
    themeId
  );
  const deletableStorageIds = uniqueCandidateStorageIds.filter(
    (storageId) => !referencedStorageIds.has(storageId)
  );

  await deleteStorageIdsSafely(ctx, deletableStorageIds, errorLabel);
}
