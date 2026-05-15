export type VisibleUser = {
  nickname?: string | null;
  discriminator?: number | null;
  name?: string | null;
  email?: string | null;
};

export const UNKNOWN_USER_LABEL = "Someone";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatPaddedHandle(user: VisibleUser | null | undefined): string | null {
  const nickname = clean(user?.nickname);
  if (!nickname || typeof user?.discriminator !== "number" || !Number.isFinite(user.discriminator)) {
    return null;
  }
  return `${nickname}#${user.discriminator.toString().padStart(4, "0")}`;
}

export function formatVisibleUser(
  user: VisibleUser | null | undefined,
  fallback = UNKNOWN_USER_LABEL
): string {
  const handle = formatPaddedHandle(user);
  if (handle) return handle;

  const nickname = clean(user?.nickname);
  if (nickname) return nickname;

  const name = clean(user?.name);
  if (name) return name;

  const email = clean(user?.email);
  if (email) {
    const [prefix] = email.split("@");
    const cleanPrefix = clean(prefix);
    if (cleanPrefix) return cleanPrefix;
    return email;
  }

  return fallback;
}

export function getVisibleUserInitials(
  user: VisibleUser | null | undefined,
  fallback = "?"
): string {
  const label = formatVisibleUser(user, fallback);
  const base = label.includes("#") ? label.split("#")[0] : label;
  const words = base.split(/\s+/).filter(Boolean);
  const initials = words.length > 1
    ? words.map((word) => word[0]).join("")
    : base.slice(0, 1);
  return initials.toUpperCase() || fallback;
}
