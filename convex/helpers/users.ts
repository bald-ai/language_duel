import type { Doc, Id } from "../_generated/dataModel";

type UserDoc = Doc<"users">;

type UserLoaderCtx = {
  db: {
    get: (id: Id<"users">) => Promise<UserDoc | null>;
  };
};

export async function loadUsersById(
  ctx: UserLoaderCtx,
  userIds: Id<"users">[]
): Promise<Map<Id<"users">, UserDoc | null>> {
  const uniqueIds = Array.from(new Set(userIds));
  const users = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
  const usersById = new Map<Id<"users">, UserDoc | null>();

  uniqueIds.forEach((id, index) => {
    usersById.set(id, users[index] ?? null);
  });

  return usersById;
}
