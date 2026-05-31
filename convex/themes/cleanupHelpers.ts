import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  collectTtsStorageIds,
  deleteStorageIdsSafely,
  getSnapshotReferencedStorageIdsForTheme,
} from "../helpers/themeTtsStorage";

type RowWithOptionalTts = { ttsStorageId?: Id<"_storage"> };

/**
 * After a content edit (words or sentence rounds), delete the storage files
 * that the new content no longer references — unless a locked weekly-goal
 * snapshot of this theme still points at them.
 */
export async function cleanupThemeTtsAfterContentUpdate(
  ctx: MutationCtx,
  themeId: Id<"themes">,
  previousRows: RowWithOptionalTts[],
  nextRows: RowWithOptionalTts[]
) {
  const previousStorageIds = collectTtsStorageIds(previousRows);
  const nextStorageIds = collectTtsStorageIds(nextRows);

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
