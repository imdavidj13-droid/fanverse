import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  Compass,
  Users,
  Bell,
  Mail,
  Bookmark,
  User,
  Search,
  Plus,
  Heart,
  X,
  Check,
  Sparkles,
  Music,
  Clapperboard,
  Headphones,
  Settings,
} from "lucide-react";
import { fandoms, type Post } from "./data";
import {
  loadState,
  storageKey,
  toggleValue,
  filterPosts,
  type State,
} from "./model";
import { useRoute, navigate, pagePaths, fandomPath } from "./routes";
import { Composer, Avatar } from "./Composer";
import { PostCard } from "./PostCard";
import { ProfilePage } from "./Profile";
import { LiveArea } from "./LiveArea";
import { BookmarksPage } from "./BookmarksPage";
import { HomeFeed, HomeSidebar } from "./HomeFeed";
import { Onboarding } from "./Onboarding";
import { SignupLanding } from "./SignupLanding";
import { api } from "./api";
import { PartiesRail } from "./ListeningParties";
import { FandomPage, FandomSidebar } from "./FandomPage";
import { AppLink as Link } from "./Navigation";
import { LocalPages } from "./LocalPages";
import { recordActivity } from "./activity";
import "./styles.css";
const nav = [
  { name: "Home", icon: Home },
  { name: "Explore", icon: Compass },
  { name: "My fandoms", icon: Users },
  { name: "Catalogue", icon: Compass },
  { name: "Listening parties", icon: Headphones },
  { name: "Notifications", icon: Bell },
  { name: "Messages", icon: Mail },
  { name: "Bookmarks", icon: Bookmark },
  { name: "Profile", icon: User },
  { name: "Community", icon: Users },
  { name: "Account", icon: User },
  { name: "Settings", icon: Settings },
];
function App() {
  const route = useRoute(),
    page = route.page,
    active = route.fandom,
    query = route.query,
    tab = route.tab;
  const connectedArea = [
    "Account",
    "Community",
    "Admin",
    "Catalogue fandom",
  ].includes(page);
  const [state, setState] = useState(loadState),
    [compose, setCompose] = useState(false),
    [notice, setNotice] = useState(""),
    [saveError, setSaveError] = useState("");
  const [previewAccess,setPreviewAccess] = useState(() => { try { return sessionStorage.getItem("fanverse.preview-entry") === "yes"; } catch { return false; } });
  const [authenticated,setAuthenticated] = useState(false);
  const [onboarding,setOnboarding] = useState<{display_name:string}|null>(null);
  const [authChecked,setAuthChecked] = useState(false);
  useEffect(() => { let active = true; const check = async () => { try { const status = await api<{ready:boolean}>("/api/status"); const me = status.ready ? await api<{profile:{display_name:string}|null;onboardingCompleted?:boolean}>("/api/me") : null; if(active){setAuthenticated(Boolean(me?.profile));setOnboarding(me?.profile && !me.onboardingCompleted ? me.profile : null);} } catch { if(active)setAuthenticated(false); } finally {if(active)setAuthChecked(true);} }; void check(); window.addEventListener("fanverse-auth-changed",check); return () => { active=false; window.removeEventListener("fanverse-auth-changed",check); }; }, []);
  useEffect(() => {if(page === "Onboarding" && authChecked && authenticated && !onboarding)navigate("/");},[page,authChecked,authenticated,onboarding]);
  const dialog = useRef<HTMLDialogElement>(null);
  const update = (fn: (s: State) => State) =>
    setState((before) => recordActivity(before, fn(before)));
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setSaveError("");
    } catch {
      setSaveError(
        "Your latest changes could not be saved. Browser storage may be full or disabled. Keep this tab open; remove a photo post or enable storage before refreshing.",
      );
    }
  }, [state]);
  useEffect(() => {
    document.title = page === "Sign up" || (page === "Home" && !active && !previewAccess && !authenticated) ? "Join your fandoms" : `${active ? fandoms.find((f) => f.id === active)?.name : page} · Your fandoms`;
  }, [page, active, previewAccess, authenticated]);
  useEffect(() => {
    if (compose) dialog.current?.showModal();
    else dialog.current?.close();
  }, [compose]);
  useEffect(() => {
    document.documentElement.dataset.density = state.preferences.compact
      ? "compact"
      : "comfortable";
    document.documentElement.dataset.text = state.preferences.largeText
      ? "large"
      : "normal";
  }, [state.preferences.compact, state.preferences.largeText]);
  const searchHref = (value: string) => {
    const params = new URLSearchParams(
      page === "Explore" ? location.search : "",
    );
    if (value) params.set("q", value);
    else params.delete("q");
    return "/explore" + (params.size ? "?" + params : "");
  };
  const membership = (id: string) =>
    update((s) => ({ ...s, joined: toggleValue(s.joined, id) }));
  const publish = (post: Post) => {
    update((s) => ({ ...s, posts: [post, ...s.posts] }));
    setCompose(false);
    navigate("/");
    setNotice(
      "Post added. Your posts and activity are saved on this browser only.",
    );
  };
  const visible = filterPosts(state, { page, tab, fandom: active, query });
  if (page === "Profile" && state.profileStyle.pinnedPostId)
    visible.sort(
      (a, b) =>
        Number(b.id === state.profileStyle.pinnedPostId) -
        Number(a.id === state.profileStyle.pinnedPostId),
    );
  const community = fandoms.find((f) => f.id === active);
  if (onboarding) return <Onboarding initialName={onboarding.display_name} onComplete={() => {setOnboarding(null);setAuthenticated(true);navigate("/");}} />;
  if (!authChecked && ["Account","Home","Onboarding","Sign up","Sign in"].includes(page)) return <main className="signup-screen"><section className="signup-card"><p role="status">Getting your account ready…</p></section></main>;
  if (page === "Onboarding") return <SignupLanding onExplore={() => navigate("/")} onAuthenticated={() => {window.dispatchEvent(new Event("fanverse-auth-changed"));navigate("/account");}} />;
  if (["Sign up","Sign in"].includes(page) || (page === "Home" && !active && !previewAccess && !authenticated)) return <SignupLanding initialMode={page === "Sign in" ? "login" : "signup"} onExplore={() => { setPreviewAccess(true); try { sessionStorage.setItem("fanverse.preview-entry","yes"); } catch { /* This visit still works. */ } navigate("/"); }} onAuthenticated={() => { window.dispatchEvent(new Event("fanverse-auth-changed")); navigate("/onboarding"); }} />;
  return (
    <>
      <a className="skip" href="#main">
        Skip to feed
      </a>
      <div className="shell">
        <aside className="sidebar">
          <Link className="brand" href="/">
            <Sparkles fill="currentColor" />
            Your fandoms
          </Link>
          <nav aria-label="Main navigation">
            {nav.map(({ name, icon: Icon }) => (
              <Link
                key={name}
                className={"nav-item " + (page === name ? "selected" : "")}
                href={pagePaths[name]}
                aria-current={page === name && !active ? "page" : undefined}
              >
                <Icon size={21} />
                <span>{name}</span>
              </Link>
            ))}
          </nav>
          <div className="side-fandoms">
            <div className="section-label">
              YOUR FANDOMS <Link href="/fandoms">Manage</Link>
            </div>
            {fandoms
              .filter((f) => state.joined.includes(f.id))
              .map((f) => (
                <Link
                  className={
                    "fandom-link " + (active === f.id ? "selected" : "")
                  }
                  key={f.id}
                  href={fandomPath(f.id)}
                >
                  <span
                    className="fandom-avatar"
                    style={{ background: f.color }}
                  >
                    {f.symbol}
                  </span>
                  <span>
                    {f.name}
                    <small>{f.members} fans · Sample</small>
                  </span>
                </Link>
              ))}
            <Link className="discover-link" href="/explore">
              <Plus size={17} />
              Discover fandoms
            </Link>
          </div>
          <button
            className="primary new-post"
            onClick={() =>
              connectedArea ? navigate("/community") : setCompose(true)
            }
          >
            <Plus size={19} />
            {connectedArea ? "Open shared feed" : "Create a post"}
          </button>
          <Link
            className="side-footer"
            href={connectedArea ? "/account" : "/profile"}
          >
            {connectedArea ? (
              <>
                <span className="avatar me">
                  <User size={19} />
                </span>
                <div>
                  <strong>Your account</strong>
                  <small>Shared community</small>
                </div>
              </>
            ) : (
              <>
                <Avatar profile={state.profile} />
                <div>
                  <strong>{state.profile.name}</strong>
                  <small>@david · Local profile</small>
                </div>
              </>
            )}
          </Link>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <Link className="brand mobile-brand" href="/">
              <Sparkles fill="currentColor" />
              Your fandoms
            </Link>
            <label className="search">
              <Search size={19} />
              <input
                aria-label="Search posts"
                placeholder="Search fandoms, people, conversations…"
                value={query}
                onChange={(e) =>
                  navigate(searchHref(e.target.value), {
                    replace: page === "Explore",
                    scroll: false,
                  })
                }
              />
            </label>
            <Link
              className="icon-button desktop-bell"
              aria-label="Notifications"
              href="/notifications"
            >
              <Bell size={21} />
              {state.activity.some((a) => !a.read) && (
                <span className="bell-unread" aria-hidden="true">
                  {state.activity.filter((a) => !a.read).length}
                </span>
              )}
            </Link>
            <Link
              className="profile-button"
              aria-label="Your profile"
              href={connectedArea ? "/account" : "/profile"}
            >
              {connectedArea ? (
                <span className="avatar me">
                  <User size={18} />
                </span>
              ) : (
                <Avatar profile={state.profile} />
              )}
            </Link>
          </header>
          <div
            className={"content-grid " + (page === "Admin" ? "admin-grid" : "")}
          >
            <main id="main">
              <div className="demo-label">
                <span />
                {["Account", "Community", "Admin"].includes(page)
                  ? "Community services · Account and backend connection"
                  : "Local preview · Your activity stays on this browser"}
              </div>
              {saveError && (
                <div role="alert" className="save-error">
                  {saveError}
                </div>
              )}
              {notice && (
                <div role="status" className="notice">
                  {notice}
                  <button
                    aria-label="Dismiss notification"
                    onClick={() => setNotice("")}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {!route.found ? (
                <div className="empty-state">
                  <h1>Page not found</h1>
                  <p>This address doesn’t match a community page.</p>
                  <Link className="primary" href="/">
                    Back home
                  </Link>
                </div>
              ) : (
                <>
                  {community ? (
                    <FandomPage key={community.id} community={community} state={state} update={update} onNotice={setNotice} />
                  ) : page === "Home" ? (
                    <HomeFeed state={state} update={update} onNotice={setNotice} onPublish={publish} />
                  ) : page === "Bookmarks" ? (
                    <BookmarksPage state={state} update={update} onNotice={setNotice} />
                  ) : page === "Profile" ? (
                    <ProfilePage state={state} update={update} onNotice={setNotice} onCompose={()=>setCompose(true)} />
                  ) : ["Account", "Community", "Admin"].includes(page) ? (
                    <LiveArea page={page} />
                  ) : [
                      "Explore",
                      "Post",
                      "Fan",
                      "Settings",
                      "Notifications",
                      "Profile studio",
                      "Catalogue",
                      "Catalogue fandom",
                      "Listening parties",
                      "Listening party",
                    ].includes(page) ? (
                    <LocalPages
                      key={page === "Fan" ? location.pathname : page}
                      state={state}
                      update={update}
                      onNotice={setNotice}
                    />
                  ) : (
                    <>
                        <div className="page-heading">
                          <div>
                            <h1>{page}</h1>
                            <p>
                              {page === "Explore"
                                ? "Find your next favourite corner of the internet."
                                : page === "My fandoms"
                                  ? "A little home for everything you love."
                                  : page === "Bookmarks"
                                    ? "Conversations you want to come back to."
                                    : page === "Profile"
                                      ? "Your own little corner of the community."
                                      : "Your community activity, all in one place."}
                            </p>
                          </div>
                        </div>

                      {(page === "Explore" || page === "My fandoms") && (
                        <>
                          <div className="category-label">
                            <Music size={16} />
                            MUSIC & BEYOND
                            <Clapperboard size={16} />
                          </div>
                          <div className="community-list">
                            {fandoms
                              .filter(
                                (f) =>
                                  (page !== "My fandoms" ||
                                    state.joined.includes(f.id)) &&
                                  (!query ||
                                    f.name
                                      .toLowerCase()
                                      .includes(query.toLowerCase())),
                              )
                              .map((f) => (
                                <section className="community-card" key={f.id}>
                                  <span
                                    className="community-symbol"
                                    style={{ background: f.color }}
                                  >
                                    {f.symbol}
                                  </span>
                                  <Link
                                    className="community-title"
                                    href={fandomPath(f.id)}
                                  >
                                    <h2>{f.name}</h2>
                                    <p>{f.description}</p>
                                    <small>
                                      {f.members} fans · Demo community
                                    </small>
                                  </Link>
                                  <button
                                    className={
                                      state.joined.includes(f.id)
                                        ? "secondary"
                                        : "primary"
                                    }
                                    onClick={() => membership(f.id)}
                                  >
                                    {state.joined.includes(f.id) ? (
                                      <Check size={17} />
                                    ) : (
                                      <Plus size={17} />
                                    )}
                                    <span>
                                      {state.joined.includes(f.id)
                                        ? "Joined"
                                        : "Join"}
                                    </span>
                                  </button>
                                </section>
                              ))}
                          </div>
                          {page === "Explore" && (
                            <h2 className="results-title">
                              Conversations {query && "matching your search"}
                            </h2>
                          )}
                          {page === "My fandoms" &&
                            state.joined.length === 0 && (
                              <div className="empty-state">
                                <h2>Find your people</h2>
                                <Link className="primary" href="/explore">
                                  Explore fandoms
                                </Link>
                              </div>
                            )}
                        </>
                      )}
                      {page === "Notifications" || page === "Messages" ? (
                        <div className="empty-state">
                          <span className="empty-icon">
                            {page === "Messages" ? <Mail /> : <Bell />}
                          </span>
                          <h2>
                            {page === "Messages"
                              ? "Your conversations will live here"
                              : "Your notifications will live here"}
                          </h2>
                          <p>
                            {page === "Messages"
                              ? "Private messaging needs real accounts and shared storage."
                              : "Notifications from other people will appear once real accounts are connected."}
                          </p>
                          <Link className="secondary" href="/">
                            Back to the feed
                          </Link>
                        </div>
                      ) : (
                        page !== "My fandoms" && (
                          <>
                            {visible.map((p) => (
                              <PostCard
                                key={p.id}
                                post={p}
                                state={state}
                                update={update}
                                onCommunity={() =>
                                  navigate(fandomPath(p.fandom))
                                }
                                onNotice={setNotice}
                              />
                            ))}
                            {visible.length === 0 && (
                              <div className="empty-state">
                                <Bookmark />
                                <h2>
                                  {page === "Bookmarks"
                                    ? "Save something you love"
                                    : "No posts here yet"}
                                </h2>
                                <p>
                                  {page === "Bookmarks"
                                    ? "Tap the bookmark beneath a post to keep it here."
                                    : "Try another filter or start a conversation."}
                                </p>
                              </div>
                            )}
                          </>
                        )
                      )}
                    </>
                  )}
                </>
              )}
            </main>
            <aside className="rightbar">
              {community ? <FandomSidebar community={community} /> : <>
              {page === "Home" && <HomeSidebar state={state} />}
              <PartiesRail joined={state.joined} />

              <section className="rail-card">
                <div className="rail-title">
                  <h2>Find your people</h2>
                  <Users size={17} />
                </div>
                {fandoms.slice(0, 3).map((f) => (
                  <div className="suggestion" key={f.id}>
                    <span
                      className="fandom-avatar"
                      style={{ background: f.color }}
                    >
                      {f.symbol}
                    </span>
                    <Link href={fandomPath(f.id)}>
                      <strong>{f.name}</strong>
                      <small>{f.members} fans · Sample</small>
                    </Link>
                    <button
                      className="join-button"
                      aria-label={
                        (state.joined.includes(f.id) ? "Leave " : "Join ") +
                        f.name
                      }
                      onClick={() => membership(f.id)}
                    >
                      {state.joined.includes(f.id) ? (
                        <Check size={17} />
                      ) : (
                        <Plus size={17} />
                      )}
                    </button>
                  </div>
                ))}
              </section>
              <p className="rail-footer">
                Made for the things you love. ♡<br />
                Community preview · Name to come
              </p>
              </>}
            </aside>
          </div>
        </div>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav
          .filter((item) =>
            ["Home", "Explore", "My fandoms", "Community", "Account"].includes(
              item.name,
            ),
          )
          .map(({ name, icon: Icon }) => (
            <Link
              aria-current={page === name && !active ? "page" : undefined}
              className={page === name ? "selected" : ""}
              key={name}
              href={pagePaths[name]}
            >
              <Icon size={21} />
              <span>{name === "My fandoms" ? "Fandoms" : name}</span>
            </Link>
          ))}
      </nav>
      {![
        "Admin",
        "Settings",
        "Profile studio",
        "Catalogue",
        "Catalogue fandom",
        "Listening parties",
        "Listening party",
      ].includes(page) && (
        <button
          className="floating-post primary"
          aria-label="Create a post"
          onClick={() =>
            connectedArea ? navigate("/community") : setCompose(true)
          }
        >
          <Plus />
        </button>
      )}
      <dialog
        aria-labelledby="composer-title"
        className="modal native-modal"
        ref={dialog}
        onCancel={() => setCompose(false)}
        onClose={() => setCompose(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setCompose(false);
        }}
      >
        <div className="modal-heading">
          <h2 id="composer-title">Create a post</h2>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close composer"
            onClick={() => setCompose(false)}
          >
            <X />
          </button>
        </div>
        {compose && (
          <Composer
            profile={state.profile}
            onPublish={publish}
            onNotice={setNotice}
            context="modal"
            initialFandom={active || state.joined[0] || "taylor"}
          />
        )}
        <p>Local preview · Your activity stays on this browser.</p>
      </dialog>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
