import type { Doc } from "../_generated/dataModel";

export type UserSummary = Pick<
  Doc<"users">,
  "_id" | "name" | "nickname" | "discriminator" | "imageUrl"
>;

export function toUserSummary(user: Doc<"users"> | null): UserSummary | null {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    nickname: user.nickname,
    discriminator: user.discriminator,
    imageUrl: user.imageUrl,
  };
}
