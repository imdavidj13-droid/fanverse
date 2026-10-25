import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  MoreHorizontal,
  EyeOff,
  Share2,
} from "lucide-react";
import { fandoms, type Post } from "./data";
import { pollResults, type State } from "./model";
import { Avatar } from "./Composer";
import { AppLink } from "./Navigation";
import { MediaViewer } from "./MediaViewer";
export function PostCard({
  post: p,
  state,
  update,
  onCommunity,
  onNotice,
  detail = false,
}: {
  post: Post;
  state: State;
  update: (fn: (s: State) => State) => void;
  onCommunity: () => void;
  onNotice: (s: string) => void;
  detail?: boolean;
}) {
  const [menu, setMenu] = useState(false),
    [replyOpen, setReplyOpen] = useState(detail),
    [reply, setReply] = useState(""),
    [revealed, setRevealed] = useState(false),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("Harassment or bullying"),
    [editing, setEditing] = useState(false),
    [edit, setEdit] = useState(p.text),
    [deleting, setDeleting] = useState(false);
  const fandom = fandoms.find((f) => f.id === p.fandom)!;
  const liked = state.liked.includes(p.id),
    saved = state.saved.includes(p.id),
    reposted = state.reposted.includes(p.id),
    vote = state.votes[p.id],
    replies = state.replies[p.id] || [],
    percent = pollResults(p, vote);
  const toggle = (key: "liked" | "saved" | "reposted") =>
    update((s) => ({
      ...s,
      [key]: s[key].includes(p.id)
        ? s[key].filter((id) => id !== p.id)
        : [...s[key], p.id],
    }));
  const moderate = (key: "blocked" | "muted") => {
    update((s) => ({
      ...s,
      [key]: [...s[key], p.handle],
      ...(key === "blocked"
        ? { following: s.following.filter((handle) => handle !== p.handle) }
        : {}),
    }));
    onNotice(
      `${key === "blocked" ? "Blocked" : "Muted"} @${p.handle}. Manage this in Profile → Preferences.`,
    );
  };
  return (
    <article className="post">
      {reposted && !p.own && (
        <div className="repost-context">
          <Repeat2 size={12} />
          You reposted
        </div>
      )}
      <div className="post-header">
        {p.own ? (
          <Avatar profile={state.profile} />
        ) : (
          <span className="avatar" style={{ background: fandom.color }}>
            {p.avatar}
          </span>
        )}
        <div>
          <AppLink
            className="author-link"
            href={p.own ? "/profile" : "/fans/" + p.handle}
          >
            <strong>{p.own ? state.profile.name : p.author}</strong>
          </AppLink>
          <span className="handle">
            {" "}
            @{p.handle} · {p.own ? "You" : "Demo"}
          </span>
          <button className="fandom-tag" onClick={onCommunity}>
            {fandom.name}
          </button>
        </div>
        <button
          className="post-more"
          aria-label={`Options for ${p.handle}'s post`}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <MoreHorizontal size={19} />
        </button>
      </div>
      <AppLink className="post-permalink" href={"/posts/" + p.id}>
        {p.createdAt ? new Date(p.createdAt).toLocaleString() : "Sample post"} ·
        View conversation
      </AppLink>
      {menu && (
        <div className="post-menu">
          {p.own ? (
            <>
              <button
                onClick={() => {
                  setEditing(true);
                  setMenu(false);
                  setEdit(p.text);
                }}
              >
                Edit post
              </button>
              <button
                onClick={() => {
                  setDeleting(true);
                  setMenu(false);
                }}
              >
                Delete post
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  update((s) => ({
                    ...s,
                    following: s.following.includes(p.handle)
                      ? s.following.filter((h) => h !== p.handle)
                      : [...s.following, p.handle],
                  }));
                  setMenu(false);
                }}
              >
                {state.following.includes(p.handle) ? "Unfollow" : "Follow"} @
                {p.handle}
              </button>
              <button onClick={() => moderate("muted")}>
                Mute @{p.handle}
              </button>
              <button onClick={() => moderate("blocked")}>
                Block @{p.handle}
              </button>
              <button
                onClick={() => {
                  setReport(true);
                  setMenu(false);
                }}
              >
                Report post
              </button>
            </>
          )}
        </div>
      )}
      {deleting && (
        <div className="inline-panel">
          <strong>Delete this post?</strong>
          <p>Its local replies and saved activity will also be removed.</p>
          <div>
            <button className="secondary" onClick={() => setDeleting(false)}>
              Cancel
            </button>
            <button
              className="danger"
              onClick={() =>
                update((s) => {
                  const votes = { ...s.votes },
                    replies = { ...s.replies };
                  delete votes[p.id];
                  delete replies[p.id];
                  return {
                    ...s,
                    posts: s.posts.filter((post) => post.id !== p.id),
                    liked: s.liked.filter((id) => id !== p.id),
                    saved: s.saved.filter((id) => id !== p.id),
                    reposted: s.reposted.filter((id) => id !== p.id),
                    votes,
                    replies,
                  };
                })
              }
            >
              Delete post
            </button>
          </div>
        </div>
      )}
      {report && (
        <form
          className="inline-panel"
          onSubmit={(e) => {
            e.preventDefault();
            update((s) => ({
              ...s,
              reports: [
                ...s.reports,
                { postId: p.id, reason, createdAt: new Date().toISOString() },
              ],
            }));
            setReport(false);
            onNotice(
              "Report saved on this browser only. No moderator has received it; shared moderation is not connected yet.",
            );
          }}
        >
          <strong>Why are you reporting this post?</strong>
          <select
            aria-label="Report reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {[
              "Harassment or bullying",
              "Spam or scam",
              "Hateful content",
              "Other concern",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <p>
            Preview only: this report is stored locally and is not sent to a
            moderator.
          </p>
          <div>
            <button
              type="button"
              className="secondary"
              onClick={() => setReport(false)}
            >
              Cancel
            </button>
            <button className="primary">Save local report</button>
          </div>
        </form>
      )}
      {p.spoiler && state.preferences.hideSpoilers && !revealed ? (
        <button className="spoiler-cover" onClick={() => setRevealed(true)}>
          <EyeOff size={23} />
          <strong>Spoiler warning</strong>
          <span>Tap to reveal this post</span>
        </button>
      ) : (
        <>
          {editing ? (
            <form
              className="inline-panel"
              onSubmit={(e) => {
                e.preventDefault();
                update((s) => ({
                  ...s,
                  posts: s.posts.map((post) =>
                    post.id === p.id ? { ...post, text: edit.trim() } : post,
                  ),
                }));
                setEditing(false);
              }}
            >
              <textarea
                aria-label="Edit post text"
                value={edit}
                maxLength={500}
                onChange={(e) => setEdit(e.target.value)}
              />
              <div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button className="primary" disabled={!edit.trim() && !p.image}>
                  Save edit
                </button>
              </div>
            </form>
          ) : (
            <p className="post-text">{p.text}</p>
          )}
          {p.art && (
            <figure className="concert-photo">
              <MediaViewer
                src="/media/concert.jpg"
                alt="A concert crowd beneath warm stage lights"
                caption="Concert moodboard · Stock photo, not an artist event"
              />
              <figcaption>
                Concert moodboard · Stock photo, not an artist event
              </figcaption>
            </figure>
          )}
          {p.image && (
            <div className="uploaded-media">
              <MediaViewer
                src={p.image}
                alt={
                  p.imageAlt ||
                  "Photo shared by " + (p.own ? state.profile.name : p.author)
                }
              />
            </div>
          )}{" "}
          {p.poll && (
            <div className="poll">
              {p.poll.map((option, i) => (
                <button
                  key={i}
                  aria-pressed={vote === i}
                  className={vote === i ? "voted" : ""}
                  onClick={() =>
                    update((s) => ({ ...s, votes: { ...s.votes, [p.id]: i } }))
                  }
                >
                  <span
                    className="poll-fill"
                    style={{
                      width: vote === undefined ? "0%" : percent[i] + "%",
                    }}
                  />
                  <span>
                    {vote === i && "✓ "}
                    {option}
                  </span>
                  {vote !== undefined && <b>{percent[i]}%</b>}
                </button>
              ))}
              <small>
                {p.own
                  ? vote === undefined
                    ? "Vote in your poll · Local preview"
                    : "Your vote is saved on this browser"
                  : "Demo poll · Sample votes plus your local selection"}
              </small>
            </div>
          )}
        </>
      )}
      <div className="post-actions">
        <button
          aria-label="Like post"
          aria-pressed={liked}
          className={liked ? "liked" : ""}
          onClick={() => toggle("liked")}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
          {(p.likes + Number(liked)).toLocaleString()}
        </button>
        <button
          aria-label="Reply to post"
          aria-expanded={replyOpen}
          onClick={() => setReplyOpen(!replyOpen)}
        >
          <MessageCircle size={18} />
          {replies.length || "Reply"}
        </button>
        <button
          aria-label="Repost"
          aria-pressed={reposted}
          className={reposted ? "selected" : ""}
          onClick={() => toggle("reposted")}
        >
          <Repeat2 size={19} />
          {reposted ? "Reposted" : "Repost"}
        </button>
        <button
          aria-label={saved ? "Remove bookmark" : "Bookmark post"}
          aria-pressed={saved}
          onClick={() => toggle("saved")}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        <button
          aria-label="Copy preview post link"
          onClick={async () => {
            const url = location.origin + "/posts/" + p.id;
            try {
              await navigator.clipboard.writeText(url);
              onNotice(
                "Preview link copied. Personal preview posts are only available in the browser where they were created.",
              );
            } catch {
              onNotice("Copy this preview link: " + url);
            }
          }}
        >
          <Share2 size={17} />
        </button>
      </div>
      {replyOpen && (
        <>
          <div className="replies">
            {replies.map((r) => (
              <div className="reply" key={r.id}>
                <strong>{state.profile.name}</strong> {r.text}
                <button
                  aria-label="Delete your reply"
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      replies: {
                        ...s.replies,
                        [p.id]: replies.filter((item) => item.id !== r.id),
                      },
                    }))
                  }
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <form
            className="reply-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              update((s) => ({
                ...s,
                replies: {
                  ...s.replies,
                  [p.id]: [
                    ...(s.replies[p.id] || []),
                    { id: Date.now(), text: reply.trim() },
                  ],
                },
              }));
              setReply("");
            }}
          >
            <input
              aria-label="Your reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Add to the conversation…"
              maxLength={500}
            />
            <button className="primary" disabled={!reply.trim()}>
              Reply
            </button>
          </form>
        </>
      )}
    </article>
  );
}
