import { useEffect, useState } from "react";
import { api, type LiveProfile, type Page } from "./api";
import { fandoms } from "./data";
import { navigate, useRoute } from "./routes";
import { AdminPanel } from "./admin/AdminPanel";
import { AdminPreview } from "./admin/AdminPreview";
interface SharedPost {
  id: number;
  user_id: string;
  username: string;
  display_name: string;
  fandom_id: string;
  text: string;
  created_at: string;
  likes: number;
  liked: number;
  bookmarked: number;
  following: number;
}
export function LiveArea({ page }: { page: string }) {
  const [ready, setReady] = useState<boolean | null>(null),
    [profile, setProfile] = useState<LiveProfile | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    setReady(null);
    (async () => {
      try {
        const config = await api<{ ready: boolean }>("/api/status");
        if (cancelled) return;
        setReady(config.ready);
        if (config.ready) {
          const me = await api<{ profile: LiveProfile | null }>("/api/me");
          if (!cancelled) setProfile(me.profile);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/sign-out", "POST", {});
      setProfile(null);
      setRefresh((n) => n + 1);
      setStatus("Signed out.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (page === "Admin" && (!ready || !profile)) return <AdminPreview key={location.pathname} />;
  return (
    <section className="live-area">
      <div className="live-title">
        <h1>
          {page === "Admin"
            ? "Administration"
            : page === "Account"
              ? "Your account"
              : "Shared community"}
        </h1>
        <span className="live-badge">
          {ready ? "Connected to D1" : "Backend setup"}
        </span>
      </div>
      <nav className="live-tabs" aria-label="Account and community">
        <a
          href="/community"
          onClick={(e) => {
            if (
              e.button === 0 &&
              !e.ctrlKey &&
              !e.metaKey &&
              !e.shiftKey &&
              !e.altKey
            ) {
              e.preventDefault();
              navigate("/community");
            }
          }}
        >
          Shared feed
        </a>
        <a
          href="/account"
          onClick={(e) => {
            if (
              e.button === 0 &&
              !e.ctrlKey &&
              !e.metaKey &&
              !e.shiftKey &&
              !e.altKey
            ) {
              e.preventDefault();
              navigate("/account");
            }
          }}
        >
          Account
        </a>
        {profile && profile.role !== "member" && (
          <a
            href="/admin"
            onClick={(e) => {
              if (
                e.button === 0 &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.shiftKey &&
                !e.altKey
              ) {
                e.preventDefault();
                navigate("/admin");
              }
            }}
          >
            Admin
          </a>
        )}
      </nav>
      {error && (
        <div className="save-error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      {ready === null && !error ? (
        <p className="live-empty">Checking the account service…</p>
      ) : ready === false ? (
        <div className="setup-card">
          <h2>The shared service is being connected</h2>
          <p>
            The account and administration screens are built, but a dedicated D1
            database and account-email settings still need to be connected to
            this Worker.
          </p>
          <p>
            Your existing preview and locally saved activity are separate and
            still available.
          </p>
          <a className="secondary" href="/">
            Back to the local preview
          </a>
        </div>
      ) : (
        ready && (
          <>
            {profile && (
              <div className="live-session">
                <span>
                  Signed in as <strong>@{profile.username}</strong>
                </span>
                <button className="secondary" onClick={signOut} disabled={busy}>
                  Sign out
                </button>
              </div>
            )}
            {page === "Account" ? (
              profile ? (
                <AccountProfile
                  profile={profile}
                  onSave={() => setRefresh((n) => n + 1)}
                />
              ) : (
                <AuthForm onSignedIn={() => setRefresh((n) => n + 1)} />
              )
            ) : page === "Admin" ? (
              profile ? (
                <AdminPanel profile={profile} />
              ) : (
                <div className="empty-state">
                  <h2>Sign in to continue</h2>
                  <p>
                    This area is restricted to moderators and administrators.
                  </p>
                  <a className="primary" href="/account">
                    Sign in
                  </a>
                </div>
              )
            ) : (
              <SharedFeed profile={profile} />
            )}
          </>
        )
      )}
    </section>
  );
}
function AuthForm({ onSignedIn }: { onSignedIn: () => void }) {
  const token = new URLSearchParams(location.search).get("token"),
    [mode, setMode] = useState(token ? "reset" : "login"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const email = String(data.get("email") || ""),
        password = String(data.get("password") || "");
      if (mode === "signup") {
        await api("/api/auth/sign-up/email", "POST", {
          email,
          password,
          name: String(data.get("name")),
          callbackURL: location.origin + "/account",
        });
        setNotice("Check your email to verify your account, then sign in.");
        setMode("login");
      } else if (mode === "verify") {
        await api("/api/auth/send-verification-email", "POST", {
          email,
          callbackURL: location.origin + "/account",
        });
        setNotice("If verification is needed, an email will be sent.");
      } else if (mode === "forgot") {
        await api("/api/auth/request-password-reset", "POST", {
          email,
          redirectTo: location.origin + "/account",
        });
        setNotice(
          "If an account exists for that email, a reset link will be sent.",
        );
      } else if (mode === "reset") {
        await api("/api/auth/reset-password", "POST", {
          token,
          newPassword: password,
        });
        setNotice("Password updated. You can now sign in.");
        setMode("login");
        history.replaceState(null, "", "/account");
      } else {
        await api("/api/auth/sign-in/email", "POST", { email, password });
        onSignedIn();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-card">
      <h2>
        {mode === "signup"
          ? "Join the community"
          : mode === "verify"
            ? "Verify your account"
            : mode === "forgot"
              ? "Reset your password"
              : mode === "reset"
                ? "Choose a new password"
                : "Welcome back"}
      </h2>
      <p>
        Real accounts are separate from the local design preview. Your
        browser-only posts are not uploaded automatically.
      </p>
      <form className="live-form" onSubmit={submit}>
        {mode === "signup" && (
          <label>
            Display name
            <input
              name="name"
              maxLength={40}
              required
              autoComplete="nickname"
            />
          </label>
        )}
        {mode !== "reset" && (
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
        )}
        {!["forgot", "verify"].includes(mode) && (
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
            <small>{mode !== "login" && "At least 12 characters."}</small>
          </label>
        )}
        {error && (
          <p className="composer-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <button className="primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : mode === "verify"
                ? "Send verification email"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "reset"
                    ? "Set password"
                    : "Sign in"}
        </button>
      </form>
      <div className="account-links">
        <button
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError("");
          }}
        >
          {mode === "signup" ? "Already have an account?" : "Create an account"}
        </button>
        <button
          onClick={() => {
            setMode("forgot");
            setError("");
          }}
        >
          Forgot password?
        </button>
        <button
          onClick={() => {
            setMode("verify");
            setError("");
          }}
        >
          Resend verification
        </button>
      </div>
    </div>
  );
}
function AccountProfile({
  profile,
  onSave,
}: {
  profile: LiveProfile;
  onSave: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="account-card">
        <h2>Your community profile</h2>
        <form
          className="live-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              await api("/api/me", "PATCH", {
                username: data.get("username"),
                displayName: data.get("displayName"),
                bio: data.get("bio"),
              });
              onSave();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Username
            <input
              name="username"
              required
              pattern="[a-z0-9_]{3,24}"
              minLength={3}
              maxLength={24}
              defaultValue={profile.username}
            />
            <small>3–24 lowercase letters, numbers or underscores.</small>
          </label>
          <label>
            Display name
            <input
              name="displayName"
              required
              maxLength={40}
              defaultValue={profile.display_name}
            />
          </label>
          <label>
            Bio
            <textarea name="bio" maxLength={180} defaultValue={profile.bio} />
          </label>
          {error && (
            <p className="composer-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            Save profile
          </button>
        </form>
      </div>
      <AccountConnections />
    </>
  );
}
export function SharedFeed({
  profile,
  fixedFandom,
  fixedName,
}: {
  profile: LiveProfile | null;
  fixedFandom?: string;
  fixedName?: string;
}) {
  const route = useRoute(),
    fandom = fixedFandom || route.sharedFandom,
    feed = route.sharedFeed;
  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    navigate("/community" + (params.size ? "?" + params : ""));
  };
  const setFeed = (value: string) => setFilter("feed", value),
    setFandom = (value: string) => setFilter("fandom", value);
  const [posts, setPosts] = useState<SharedPost[]>([]),
    [next, setNext] = useState<number | string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [memberships, setMemberships] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    setPosts([]);
    setNext(null);
    (async () => {
      try {
        const data = await api<Page<SharedPost>>(
          "/api/posts?feed=" + feed + (fandom ? "&fandom=" + fandom : ""),
        );
        if (!cancelled) {
          setPosts(data.items);
          setNext(data.next);
        }
        if (profile) {
          const me = await api<{ memberships: string[] }>("/api/me");
          if (!cancelled) setMemberships(me.memberships);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fandom, feed, refresh, profile?.user_id]);
  const [directory, setDirectory] =
    useState<{ id: string; name: string }[]>(fandoms);
  useEffect(() => {
    let cancelled = false;
    api<Page<{ id: string; name: string }>>("/api/fandoms?limit=50")
      .then((data) => {
        if (!cancelled) setDirectory(data.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (fandom)
      api<{ fandom: { id: string; name: string } }>(
        "/api/fandoms/" + encodeURIComponent(fandom),
      )
        .then((data) => {
          if (!cancelled)
            setDirectory((rows) =>
              rows.some((r) => r.id === data.fandom.id)
                ? rows
                : [...rows, data.fandom],
            );
        })
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fandom]);
  const choices =
    fixedFandom && !directory.some((f) => f.id === fixedFandom)
      ? [...directory, { id: fixedFandom, name: fixedName || fixedFandom }]
      : directory;
  const reload = () => setRefresh((n) => n + 1);
  return (
    <>
      <div className="live-feed-controls">
        <select
          aria-label="Shared feed"
          value={feed}
          onChange={(e) => setFeed(e.target.value)}
        >
          <option value="latest">Latest posts</option>
          {profile && (
            <>
              <option value="fandoms">My fandoms</option>
              <option value="following">Following</option>
              <option value="bookmarks">Bookmarks</option>
            </>
          )}
        </select>
        <select
          aria-label="Shared fandom filter"
          value={fandom}
          onChange={(e) => setFandom(e.target.value)}
        >
          <option value="">All fandoms</option>
          {choices.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button className="secondary" disabled={busy} onClick={reload}>
          Refresh
        </button>
      </div>
      {profile && (
        <div className="membership-bar">
          {choices.map((f) => (
            <button
              key={f.id}
              className={
                memberships.includes(f.id) ? "secondary selected" : "secondary"
              }
              onClick={async () => {
                try {
                  await api(
                    "/api/memberships/" + f.id,
                    memberships.includes(f.id) ? "DELETE" : "PUT",
                  );
                  reload();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {memberships.includes(f.id) ? "✓ " : "+ "}
              {f.name}
            </button>
          ))}
        </div>
      )}
      {profile ? (
        <form
          className="composer live-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              data = new FormData(form);
            setBusy(true);
            try {
              await api("/api/posts", "POST", {
                text: data.get("text"),
                fandom: data.get("fandom"),
              });
              form.reset();
              reload();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Start a conversation
            <textarea
              name="text"
              aria-label="Shared post text"
              maxLength={500}
              required
              placeholder="What’s on your mind?"
            />
          </label>
          <div className="compose-tools">
            <select
              name="fandom"
              aria-label="Shared post fandom"
              key={fandom + choices.length}
              defaultValue={fandom || choices[0]?.id || "taylor"}
            >
              {choices.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button className="primary" disabled={busy}>
              Publish
            </button>
          </div>
          <small>
            Shared text posts · Image storage and polls will be connected
            separately.
          </small>
        </form>
      ) : (
        <p className="notice">
          You can read shared posts.{" "}
          <a href="/account">Sign in to join the conversation.</a>
        </p>
      )}
      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}
      {busy && <p className="live-empty">Loading…</p>}
      {!busy && posts.length === 0 && (
        <div className="empty-state">
          <h2>No shared posts yet</h2>
          <p>Start the first conversation or try another filter.</p>
        </div>
      )}
      {posts.map((post) => (
        <SharedPostCard
          directory={choices}
          key={post.id}
          post={post}
          profile={profile}
          reload={reload}
        />
      ))}
      {next && (
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const data = await api<Page<SharedPost>>(
                "/api/posts?feed=" +
                  feed +
                  "&before=" +
                  next +
                  (fandom ? "&fandom=" + fandom : ""),
              );
              setPosts((p) => [...p, ...data.items]);
              setNext(data.next);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load older posts
        </button>
      )}
    </>
  );
}
function SharedPostCard({
  post,
  profile,
  reload,
  directory,
}: {
  directory: { id: string; name: string }[];
  post: SharedPost;
  profile: LiveProfile | null;
  reload: () => void;
}) {
  const [error, setError] = useState(""),
    [replyOpen, setReplyOpen] = useState(false),
    [replies, setReplies] = useState<
      { id: number; user_id: string; text: string; username: string }[]
    >([]),
    [reportOpen, setReportOpen] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function action(path: string, method: string, data?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, method, data);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="post shared-post">
      <div className="post-header">
        <span className="avatar me">{post.display_name.slice(0, 1)}</span>
        <div>
          <strong>{post.display_name}</strong>
          <span className="handle"> @{post.username}</span>
          <span className="fandom-tag">
            {directory.find((f) => f.id === post.fandom_id)?.name ||
              post.fandom_id}
          </span>
        </div>
      </div>
      <p className="post-text">{post.text}</p>
      <time dateTime={post.created_at}>
        {new Date(post.created_at).toLocaleString()}
      </time>
      {profile && (
        <div className="shared-actions">
          <button
            disabled={busy}
            aria-pressed={Boolean(post.liked)}
            onClick={() =>
              action(
                `/api/posts/${post.id}/likes`,
                post.liked ? "DELETE" : "PUT",
              )
            }
          >
            {post.liked ? "♥" : "♡"} {post.likes}
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setReplyOpen(!replyOpen);
              try {
                const data = await api<
                  Page<{
                    id: number;
                    user_id: string;
                    text: string;
                    username: string;
                  }>
                >(`/api/posts/${post.id}/replies`);
                setReplies(data.items);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Replies
          </button>
          <button
            disabled={busy}
            onClick={() =>
              action(
                `/api/posts/${post.id}/bookmarks`,
                post.bookmarked ? "DELETE" : "PUT",
              )
            }
          >
            {post.bookmarked ? "Saved" : "Save"}
          </button>
          {post.user_id === profile.user_id ? (
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm("Delete this shared post?"))
                  action("/api/posts/" + post.id, "DELETE");
              }}
            >
              Delete
            </button>
          ) : (
            <>
              <button
                disabled={busy}
                onClick={() => setReportOpen(!reportOpen)}
              >
                Report
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Block @" +
                        post.username +
                        "? You will stop seeing each other’s posts.",
                    )
                  )
                    action(
                      "/api/blocks/" + encodeURIComponent(post.user_id),
                      "PUT",
                    );
                }}
              >
                Block
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  action(
                    "/api/follows/" + encodeURIComponent(post.user_id),
                    post.following ? "DELETE" : "PUT",
                  )
                }
              >
                {post.following ? "Unfollow" : "Follow"}
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="composer-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {reportOpen && (
        <form
          className="inline-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            try {
              await api(`/api/posts/${post.id}/reports`, "POST", {
                reason: data.get("reason"),
              });
              setReportOpen(false);
              setNotice("Report submitted to the moderation queue.");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Reason
            <textarea name="reason" required maxLength={500} />
          </label>
          <button className="primary">Submit report</button>
        </form>
      )}
      {replyOpen && (
        <>
          <div>
            {replies.map((r) => (
              <div className="reply" key={r.id}>
                <strong>@{r.username}</strong> {r.text}
                {r.user_id === profile?.user_id && (
                  <button
                    onClick={async () => {
                      try {
                        await api("/api/replies/" + r.id, "DELETE");
                        setReplies((items) =>
                          items.filter((item) => item.id !== r.id),
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
          {profile && (
            <form
              className="reply-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  data = new FormData(form);
                try {
                  await api(`/api/posts/${post.id}/replies`, "POST", {
                    text: data.get("text"),
                  });
                  const result = await api<
                    Page<{
                      id: number;
                      user_id: string;
                      text: string;
                      username: string;
                    }>
                  >(`/api/posts/${post.id}/replies`);
                  setReplies(result.items);
                  form.reset();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <input
                name="text"
                aria-label="Shared reply"
                maxLength={500}
                required
                placeholder="Write a reply…"
              />
              <button className="primary">Reply</button>
            </form>
          )}
        </>
      )}
    </article>
  );
}
function AccountConnections() {
  const [blocked, setBlocked] = useState<
      { user_id: string; username: string }[]
    >([]),
    [following, setFollowing] = useState<
      { user_id: string; username: string }[]
    >([]),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ items: { user_id: string; username: string }[] }>("/api/me/blocks"),
      api<{ items: { user_id: string; username: string }[] }>(
        "/api/me/follows",
      ),
    ])
      .then(([blocks, follows]) => {
        if (!cancelled) {
          setBlocked(blocks.items);
          setFollowing(follows.items);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  return (
    <details className="preferences">
      <summary>Following & blocked accounts</summary>
      {error && <p role="alert">{error}</p>}
      {[
        ["Following", following, "follows", "Unfollow"],
        ["Blocked accounts", blocked, "blocks", "Unblock"],
      ].map(([title, items, kind, label]) => (
        <section key={String(title)}>
          <h3>{String(title)}</h3>
          {(items as { user_id: string; username: string }[]).length === 0 ? (
            <p>No accounts here.</p>
          ) : (
            (items as { user_id: string; username: string }[]).map((person) => (
              <div className="account-setting" key={person.user_id}>
                <span>@{person.username}</span>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await api(
                        "/api/" +
                          kind +
                          "/" +
                          encodeURIComponent(person.user_id),
                        "DELETE",
                      );
                      setRevision((n) => n + 1);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {String(label)}
                </button>
              </div>
            ))
          )}
        </section>
      ))}
    </details>
  );
}
