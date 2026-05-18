import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  collectTtsStorageIds,
  deleteStorageIdsSafely,
  getSnapshotReferencedStorageIdsForTheme,
} from "../helpers/themeTtsStorage";
import type { ThemeWordWithTts } from "./ttsPipeline";

export async function cleanupThemeTtsAfterWordUpdate(
  ctx: MutationCtx,
  themeId: Id<"themes">,
  previousWords: ThemeWordWithTts[],
  nextWords: ThemeWordWithTts[]
) {
  const previousStorageIds = collectTtsStorageIds(previousWords);
  const nextStorageIds = collectTtsStorageIds(nextWords);

  const staleStorageIds = [...previousStorageIds].filter((id) => !nextStorageIds.has(id));
  if (staleStorageIds.length === 0) {
    return;
  }

  const snapshotReferencedStorageIds = await getSnapshotReferencedStorageIdsForTheme(
    ctx,
    themeId
  );
  const deletableStorageIds = staleStorageIds.filter(
    (storageId) => !snapshotReferencedStorageIds.has(storageId)
  );

  await deleteStorageIdsSafely(
    ctx,
    deletableStorageIds,
    "[Theme TTS] Failed to delete stale storage file:"
  );
}

