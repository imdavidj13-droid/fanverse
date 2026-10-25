import { useState } from "react";
import { fandoms, initialPosts } from "./data";
import { filterPosts, toggleValue, type State } from "./model";
import { useRoute, fandomPath, navigate } from "./routes";
import { AppLink } from "./Navigation";
import { PostCard } from "./PostCard";
import { ProfileStudio } from "./ProfileStudio";
type Props = {
  state: State;
  update: (fn: (s: State) => State) => void;
  onNotice: (message: string) => void;
};
export function people(state: State) {
  return [
    {
      handle: "david",
      name: state.profile.name,
      avatar: state.profile.name.slice(0, 1),
      bio: state.profile.bio,
    },
    ...Array.from(new Set(initialPosts.map((p) => p.handle))).map((handle) => {
      const p = initialPosts.find((post) => post.handle === handle)!;
      return {
        handle,
        name: p.author,
        avatar: p.avatar,
        bio:
          "Here for " +
          (fandoms.find((f) => f.id === p.fandom)?.name || "the fandom") +
          " and good conversations.",
      };
    }),
  ];
}
function FanCard({
  handle,
  state,
  update,
}: {
  handle: string;
  state: State;
  update: Props["update"];
}) {
  const person = people(state).find((p) => p.handle === handle)!;
  return (
    <div className="fan-card">
      <AppLink
        className="fan-identity"
        href={handle === "david" ? "/profile" : "/fans/" + handle}
      >
        <span className="avatar me">{person.avatar}</span>
        <span>
          <strong>{person.name}</strong>
          <small>
            @{handle}
            {handle !== "david" ? " · Demo fan" : ""}
          </small>
        </span>
      </AppLink>
      {handle !== "david" && (
        <button
          className="secondary"
          aria-pressed={state.following.includes(handle)}
          onClick={() =>
            update((s) => ({
              ...s,
              following: toggleValue(s.following, handle),
            }))
          }
        >
          {state.following.includes(handle) ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}
export function LocalPages({ state, update, onNotice }: Props) {
  const route = useRoute(),
    [showUnread, setShowUnread] = useState(false),
    [words, setWords] = useState(state.preferences.mutedWords.join(", ")),
    [sort, setSort] = useState("latest");
  const cards = (posts: State["posts"], detail = false) =>
    posts.map((p) => (
      <PostCard
        key={p.id}
        post={p}
        state={state}
        update={update}
        onNotice={onNotice}
        onCommunity={() => {
          navigate(fandomPath(p.fandom));
        }}
        detail={detail}
      />
    ));
  const accessible = filterPosts(state, {
    page: "Explore",
    tab: "For you",
    fandom: "",
    query: "",
  });
  if (route.page === "Profile studio")
    return <ProfileStudio state={state} update={update} onNotice={onNotice} />;
  if (route.page === "Post") {
    const id = Number(location.pathname.split("/").pop()),
      post = accessible.find((p) => p.id === id);
    return (
      <>
        <div className="local-page-title">
          <AppLink href="/">← Back to feed</AppLink>
          <h1>Conversation</h1>
        </div>
        {post ? (
          cards([post], true)
        ) : (
          <div className="empty-state">
            <h2>Post unavailable</h2>
            <p>
              It may have been deleted or hidden by your preferences. Personal
              preview posts exist only in the browser where they were created.
            </p>
          </div>
        )}
      </>
    );
  }
  if (route.page === "Fan") {
    const handle = location.pathname.split("/").pop()!,
      person = people(state).find((p) => p.handle === handle),
      blocked = state.blocked.includes(handle),
      posts = accessible.filter((p) => p.handle === handle);
    return (
      <>
        <div className="local-page-title">
          <AppLink href="/explore?view=people">← Find fans</AppLink>
          <h1>Fan profile</h1>
        </div>
        {person && !blocked ? (
          <>
            <section className="fan-profile">
              <FanCard handle={handle} state={state} update={update} />
              <p>{person.bio}</p>
              <small>
                {state.posts.filter((p) => p.handle === handle).length} preview
                posts ·{" "}
                {handle === "david" ? "Your local profile" : "Sample account"}
              </small>
              <div className="profile-filter-links">
                <AppLink href={"/fans/" + handle}>Posts</AppLink>
                <AppLink href={"/fans/" + handle + "?view=media"}>
                  Media
                </AppLink>
              </div>
            </section>
            {cards(
              posts.filter(
                (p) =>
                  new URLSearchParams(location.search).get("view") !==
                    "media" ||
                  p.image ||
                  p.art,
              ),
            )}
            {posts.length === 0 && (
              <p className="live-empty">No visible preview posts.</p>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h2>Profile unavailable</h2>
            <p>
              This fan is not in the preview or is blocked in your preferences.
            </p>
          </div>
        )}
      </>
    );
  }
  if (route.page === "Settings")
    return (
      <>
        <div className="local-page-title">
          <h1>Preferences</h1>
          <p>Saved on this browser. Feed filters apply to the local preview.</p>
        </div>
        <section className="settings-card">
          <h2>Reading & display</h2>
          {(
            [
              ["compact", "Compact feed", "Fit more conversations on screen."],
              [
                "largeText",
                "Larger post text",
                "Make posts and replies easier to read.",
              ],
              [
                "hideSpoilers",
                "Hide spoilers",
                "Reveal marked spoilers only when you choose.",
              ],
              [
                "recordActivity",
                "Record my local activity",
                "Keep your own posting, saving and following history.",
              ],
            ] as const
          ).map(([key, label, description]) => (
            <label className="setting-toggle" key={key}>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <input
                type="checkbox"
                checked={state.preferences[key]}
                onChange={(e) =>
                  update((s) => ({
                    ...s,
                    preferences: { ...s.preferences, [key]: e.target.checked },
                  }))
                }
              />
            </label>
          ))}
        </section>
        <section className="settings-card">
          <h2>Your Home feed</h2>
          <p>
            Keep a joined fandom out of Home while still visiting its own page.
          </p>
          {fandoms.map((f) => (
            <label key={f.id} className="setting-toggle">
              <span>{f.name}</span>
              <input
                aria-label={"Show " + f.name + " in Home"}
                type="checkbox"
                checked={!state.homeHidden.includes(f.id)}
                onChange={() =>
                  update((s) => ({
                    ...s,
                    homeHidden: toggleValue(s.homeHidden, f.id),
                  }))
                }
              />
            </label>
          ))}
        </section>
        <form
          className="settings-card live-form"
          onSubmit={(e) => {
            e.preventDefault();
            const mutedWords = Array.from(
              new Set(
                words
                  .split(",")
                  .map((w) => w.trim().slice(0, 40))
                  .filter(Boolean),
              ),
            ).slice(0, 20);
            update((s) => ({
              ...s,
              preferences: { ...s.preferences, mutedWords },
            }));
            setWords(mutedWords.join(", "));
            onNotice("Muted words saved for this browser.");
          }}
        >
          <h2>Muted words</h2>
          <p>
            Posts containing these words or phrases are hidden across the local
            preview, including search and bookmarks.
          </p>
          <label>
            Words or phrases, separated by commas
            <textarea
              value={words}
              onChange={(e) => setWords(e.target.value)}
              maxLength={800}
            />
          </label>
          <button className="primary">Save muted words</button>
        </form>
        <p className="local-explainer">
          These controls do not enable email, push notifications or cross-device
          settings.{" "}
          <AppLink href="/profile">
            Manage muted and blocked accounts in your profile.
          </AppLink>
        </p>
      </>
    );
  if (route.page === "Notifications") {
    const events = state.activity.filter((a) => !showUnread || !a.read);
    return (
      <>
        <div className="local-page-title">
          <h1>Activity & notifications</h1>
          <p>
            Your own activity on this browser. Notifications from other people
            are not connected yet.
          </p>
        </div>
        <div className="activity-tools">
          <button
            className="secondary"
            aria-pressed={showUnread}
            onClick={() => setShowUnread(!showUnread)}
          >
            {showUnread ? "Show all" : "Unread only"}
          </button>
          <button
            className="secondary"
            disabled={!state.activity.some((a) => !a.read)}
            onClick={() =>
              update((s) => ({
                ...s,
                activity: s.activity.map((a) => ({ ...a, read: true })),
              }))
            }
          >
            Mark all read
          </button>
          <AppLink className="secondary" href="/settings">
            Preferences
          </AppLink>
        </div>
        {events.map((event) => (
          <div
            className={"activity-item " + (!event.read ? "unread" : "")}
            key={event.id}
          >
            <AppLink
              href={event.href}
              onClick={() =>
                update((s) => ({
                  ...s,
                  activity: s.activity.map((a) =>
                    a.id === event.id ? { ...a, read: true } : a,
                  ),
                }))
              }
            >
              {event.text}
            </AppLink>
            <time dateTime={event.createdAt}>
              {new Date(event.createdAt).toLocaleString()}
            </time>
            {!event.read && (
              <button
                aria-label={"Mark read: " + event.text}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    activity: s.activity.map((a) =>
                      a.id === event.id ? { ...a, read: true } : a,
                    ),
                  }))
                }
              >
                Mark read
              </button>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <div className="empty-state">
            <h2>{showUnread ? "All caught up" : "No local activity yet"}</h2>
            <p>
              Post, save a conversation or follow a fan to start your history.
            </p>
          </div>
        )}
        {state.activity.length > 0 && (
          <button
            className="text-button"
            onClick={() => update((s) => ({ ...s, activity: [] }))}
          >
            Clear activity history
          </button>
        )}
      </>
    );
  }
  const view = new URLSearchParams(location.search).get("view") || "posts",
    query = route.query.toLowerCase(),
    visible = accessible.filter((p) =>
      `${p.text} ${p.handle} ${p.author} ${fandoms.find((f) => f.id === p.fandom)?.name}`
        .toLowerCase()
        .includes(query),
    );
  const sorted = [...visible].sort((a, b) =>
    sort === "popular"
      ? b.likes +
        Number(state.liked.includes(b.id)) -
        (a.likes + Number(state.liked.includes(a.id)))
      : b.id - a.id,
  );
  return (
    <>
      <div className="local-page-title">
        <h1>Explore</h1>
        <p>Find conversations, fans and your next favourite fandom.</p>
      </div>
      <nav className="explore-tabs" aria-label="Explore categories">
        {["posts", "people", "fandoms", "media"].map((v) => (
          <AppLink
            key={v}
            className={view === v ? "selected" : ""}
            aria-current={view === v ? "page" : undefined}
            href={
              "/explore?view=" +
              v +
              (route.query ? "&q=" + encodeURIComponent(route.query) : "")
            }
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </AppLink>
        ))}
      </nav>
      {view === "people" ? (
        <>
          {people(state)
            .filter(
              (p) =>
                !state.blocked.includes(p.handle) &&
                !state.muted.includes(p.handle) &&
                `${p.handle} ${p.name}`.toLowerCase().includes(query),
            )
            .map((p) => (
              <FanCard
                key={p.handle}
                handle={p.handle}
                state={state}
                update={update}
              />
            ))}
        </>
      ) : view === "fandoms" ? (
        fandoms
          .filter((f) => f.name.toLowerCase().includes(query))
          .map((f) => (
            <section className="community-card" key={f.id}>
              <span className="fandom-avatar" style={{ background: f.color }}>
                {f.symbol}
              </span>
              <AppLink className="community-title" href={fandomPath(f.id)}>
                <h2>{f.name}</h2>
                <p>{f.description}</p>
              </AppLink>
              <button
                className="secondary"
                onClick={() =>
                  update((s) => ({ ...s, joined: toggleValue(s.joined, f.id) }))
                }
              >
                {state.joined.includes(f.id) ? "Joined" : "Join"}
              </button>
            </section>
          ))
      ) : (
        <>
          <div className="search-meta">
            <span>
              {
                sorted.filter((p) => view !== "media" || p.image || p.art)
                  .length
              }{" "}
              matching posts
            </span>
            <label>
              Sort
              <select
                aria-label="Sort search results"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="latest">Latest</option>
                <option value="popular">Most liked</option>
              </select>
            </label>
          </div>
          {cards(sorted.filter((p) => view !== "media" || p.image || p.art))}
          {sorted.filter((p) => view !== "media" || p.image || p.art).length ===
            0 && (
            <div className="empty-state">
              <h2>No matches yet</h2>
              <p>Try another search or explore another category.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
