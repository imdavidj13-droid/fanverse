import { defaultProfileStyle, type ProfileStyle } from "./profileTheme";
import { initialPosts, type Post } from "./data";
import { defaultPreferences, type Activity } from "./activity";
export type Profile = { name: string; bio: string; avatar: string };
export type Reply = { id: number; text: string };
export type State = {
  version: 1;
  profileStyle: ProfileStyle;
  preferences: typeof defaultPreferences;
  activity: Activity[];
  homeHidden: string[];
  posts: Post[];
  joined: string[];
  following: string[];
  blocked: string[];
  muted: string[];
  liked: number[];
  saved: number[];
  reposted: number[];
  votes: Record<number, number>;
  replies: Record<number, Reply[]>;
  profile: Profile;
  reports: { postId: number; reason: string; createdAt: string }[];
};
export const storageKey = "fanverse.preview.v1";
export function freshState(): State {
  return {
    version: 1,
    profileStyle: { ...defaultProfileStyle },
    preferences: { ...defaultPreferences },
    activity: [],
    homeHidden: [],
    posts: initialPosts,
    joined: ["taylor", "sabrina", "olivia"],
    following: ["swiftie.stories", "sabrinaspills"],
    blocked: [],
    muted: [],
    liked: [],
    saved: [],
    reposted: [],
    votes: {},
    replies: {},
    profile: {
      name: "David",
      bio: "Here for the music, the theories and the group chat.",
      avatar: "",
    },
    reports: [],
  };
}
export function loadState(): State {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return freshState();
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      !Array.isArray(value.posts) ||
      !Array.isArray(value.joined) ||
      !value.profile
    )
      return freshState();
    return {
      ...freshState(),
      ...value,
      profileStyle: { ...defaultProfileStyle, ...value.profileStyle },
      preferences: { ...defaultPreferences, ...value.preferences },
      activity: Array.isArray(value.activity) ? value.activity : [],
      homeHidden: Array.isArray(value.homeHidden) ? value.homeHidden : [],
    };
  } catch {
    return freshState();
  }
}
export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
export function pollResults(
  post: Post,
  selection: number | undefined,
): number[] {
  const counts =
    post.poll?.map(
      (_, i) => (post.pollCounts?.[i] ?? 0) + (selection === i ? 1 : 0),
    ) ?? [];
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((n) => (total ? Math.round((n / total) * 100) : 0));
}
export function filterPosts(
  state: State,
  {
    page,
    tab,
    fandom,
    query,
  }: { page: string; tab: string; fandom: string; query: string },
): Post[] {
  return state.posts.filter(
    (post) =>
      !state.blocked.includes(post.handle) &&
      !state.preferences.mutedWords.some((word) =>
        post.text.toLowerCase().includes(word.toLowerCase()),
      ) &&
      (page !== "Home" ||
        Boolean(fandom) ||
        !state.homeHidden.includes(post.fandom)) &&
      !state.muted.includes(post.handle) &&
      (!fandom || post.fandom === fandom) &&
      (page !== "Bookmarks" || state.saved.includes(post.id)) &&
      (page !== "Profile" || post.own || state.reposted.includes(post.id)) &&
      (page !== "Home" ||
        fandom ||
        post.own ||
        (tab === "Following"
          ? state.following.includes(post.handle)
          : tab === "My fandoms"
            ? state.joined.includes(post.fandom)
            : state.joined.includes(post.fandom) ||
              state.following.includes(post.handle))) &&
      (!query ||
        `${post.text} ${post.handle} ${post.author}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
}
