import { useSyncExternalStore } from "react";
export const pagePaths: Record<string, string> = {
  Home: "/",
  Explore: "/explore",
  "My fandoms": "/fandoms",
  Notifications: "/notifications",
  Messages: "/messages",
  Bookmarks: "/bookmarks",
  Profile: "/profile",
  Account: "/account",
  Community: "/community",
  Admin: "/admin",
};
const fandomSlugs: Record<string, string> = {
  taylor: "taylor-swift",
  sabrina: "sabrina-carpenter",
  olivia: "olivia-rodrigo",
  screen: "tv-and-film",
};
export const fandomPath = (id: string) => "/fandoms/" + (fandomSlugs[id] || id);
export function parseRoute(path: string) {
  const clean = path.replace(/\/+$/, "") || "/";
  if (/^\/admin\/(users|posts|reports|audit)$/.test(clean))
    return { page: "Admin", fandom: "", found: true };
  const fandom = Object.keys(fandomSlugs).find(
    (id) => fandomPath(id) === clean,
  );
  if (fandom) return { page: "Home", fandom, found: true };
  const page = Object.keys(pagePaths).find((page) => pagePaths[page] === clean);
  return { page: page || "Not found", fandom: "", found: Boolean(page) };
}
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const snapshot = () => window.location.pathname + window.location.search;
export function useRoute() {
  const location = useSyncExternalStore(subscribe, snapshot);
  const [path, search] = location.split("?");
  const params = new URLSearchParams(search || "");
  return {
    ...parseRoute(path),
    query: params.get("q") || "",
    sharedFeed: params.get("feed") || "latest",
    sharedFandom: params.get("fandom") || "",
    tab:
      params.get("feed") === "following"
        ? "Following"
        : params.get("feed") === "fandoms"
          ? "My fandoms"
          : "For you",
  };
}
export function navigate(
  path: string,
  {
    replace = false,
    scroll = true,
  }: { replace?: boolean; scroll?: boolean } = {},
) {
  if (path === window.location.pathname + window.location.search) return;
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
}
