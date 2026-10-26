import { restoreCollections, type BookmarkCollection } from "./bookmarkCollections";
import { defaultProfileStyle, type ProfileStyle } from "./profileTheme";
import { type Post } from "./data";
import { defaultPreferences, type Activity } from "./activity";
export type Profile = { name: string; bio: string; avatar: string; username?: string };
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
  bookmarkCollections: BookmarkCollection[];
  bookmarkAssignments: Record<number,string>;
  reposted: number[];
  votes: Record<number, number>;
  replies: Record<number, Reply[]>;
  profile: Profile;
  reports: { postId: number; reason: string; createdAt: string }[];
};
export function freshState(): State {
  return {
    version: 1,
    profileStyle: { ...defaultProfileStyle },
    preferences: { ...defaultPreferences },
    activity: [],
    homeHidden: [],
    posts: [],
    joined: [],
    following: [],
    blocked: [],
    muted: [],
    liked: [],
    saved: [],
    bookmarkCollections: [],
    bookmarkAssignments: {},
    reposted: [],
    votes: {},
    replies: {},
    profile: {
      name: "",
      bio: "",
      avatar: "",
    },
    reports: [],
  };
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
            : tab === "Discover"
              ? true
            : state.joined.includes(post.fandom) ||
              state.following.includes(post.handle))) &&
      (!query ||
        `${post.text} ${post.handle} ${post.author}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
}

export function saveToCollection(state: State, postId: number, collectionId: string): State {
  if(collectionId && !state.bookmarkCollections.some(c=>c.id===collectionId))return state;
  const assignments={...state.bookmarkAssignments};
  if(collectionId)assignments[postId]=collectionId;else delete assignments[postId];
  return {...state,saved:state.saved.includes(postId)?state.saved:[...state.saved,postId],bookmarkAssignments:assignments};
}
