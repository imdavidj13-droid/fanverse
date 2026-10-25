import type { State } from "./model";
export type Activity = {
  id: string;
  text: string;
  href: string;
  createdAt: string;
  read: boolean;
};
export const defaultPreferences = {
  compact: false,
  largeText: false,
  hideSpoilers: true,
  recordActivity: true,
  mutedWords: [] as string[],
};
export function recordActivity(before: State, after: State): State {
  if (!after.preferences.recordActivity) return after;
  let text = "",
    href = "/";
  const post = after.posts.find(
    (p) => !before.posts.some((old) => old.id === p.id),
  );
  if (post?.own) {
    text = "You published a post";
    href = "/posts/" + post.id;
  } else if (after.saved.length > before.saved.length) {
    const id = after.saved.find((id) => !before.saved.includes(id));
    text = "You bookmarked a post";
    href = "/posts/" + id;
  } else if (after.following.length > before.following.length) {
    const handle = after.following.find((h) => !before.following.includes(h));
    text = "You followed @" + handle;
    href = "/fans/" + handle;
  } else if (after.joined.length > before.joined.length) {
    text = "You joined a fandom";
    href = "/fandoms";
  } else if (
    after.profile.name !== before.profile.name ||
    after.profile.bio !== before.profile.bio ||
    after.profile.avatar !== before.profile.avatar
  ) {
    text = "You updated your profile";
    href = "/profile";
  } else {
    for (const [id, replies] of Object.entries(after.replies)) {
      if (replies.length > (before.replies[Number(id)]?.length || 0)) {
        text = "You added a reply";
        href = "/posts/" + id;
        break;
      }
    }
  }
  if (
    !text &&
    JSON.stringify(before.profileStyle) !== JSON.stringify(after.profileStyle)
  ) {
    text = "You customised your profile";
    href = "/profile";
  }
  if (!text) return after;
  return {
    ...after,
    activity: [
      {
        id: crypto.randomUUID(),
        text,
        href,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...after.activity,
    ].slice(0, 100),
  };
}
