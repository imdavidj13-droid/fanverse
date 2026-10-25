import { useState } from "react";
import { Avatar, readImage } from "./Composer";
import type { State } from "./model";
import { ProfileHeader } from "./ProfileStudio";
export function ProfilePanel({
  state,
  update,
  onNotice,
}: {
  state: State;
  update: (fn: (s: State) => State) => void;
  onNotice: (s: string) => void;
}) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(state.profile),
    [loading, setLoading] = useState(false);
  return (
    <>
      <ProfileHeader state={state}>
        <button
          className="secondary"
          onClick={() => {
            setDraft(state.profile);
            setEditing(!editing);
          }}
        >
          Edit profile
        </button>
        <a className="secondary profile-settings-link" href="/settings">
          Preferences & display
        </a>
        <a className="secondary profile-settings-link" href="/profile/edit">
          Customise your profile
        </a>
        {editing && (
          <form
            className="profile-edit"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.name.trim() || loading) return;
              update((s) => ({
                ...s,
                profile: { ...draft, name: draft.name.trim() },
              }));
              setEditing(false);
              onNotice("Profile updated on this browser.");
            }}
          >
            <label>
              Display name
              <input
                required
                maxLength={40}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Bio
              <textarea
                maxLength={180}
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              />
            </label>
            <label>
              Profile photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    ) ||
                    file.size > 250000
                  ) {
                    onNotice(
                      "Choose a JPG, PNG or WebP under 250 KB for your preview avatar.",
                    );
                    return;
                  }
                  setLoading(true);
                  try {
                    const avatar = await readImage(file);
                    setDraft((d) => ({ ...d, avatar }));
                  } catch {
                    onNotice("This photo could not be read.");
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </label>
            <div>
              <button
                type="button"
                className="secondary"
                onClick={() => setDraft({ ...draft, avatar: "" })}
              >
                Remove photo
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={!draft.name.trim() || loading}
              >
                Save profile
              </button>
            </div>
          </form>
        )}
      </ProfileHeader>
      <details className="preferences">
        <summary>Preferences & hidden accounts</summary>
        <p>These settings affect this browser only.</p>
        {(["muted", "blocked"] as const).map((key) => (
          <section key={key}>
            <h3>{key === "muted" ? "Muted accounts" : "Blocked accounts"}</h3>
            {state[key].length === 0 ? (
              <small>No accounts here.</small>
            ) : (
              state[key].map((handle) => (
                <div className="account-setting" key={handle}>
                  <span>@{handle}</span>
                  <button
                    className="secondary"
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        [key]: s[key].filter((h) => h !== handle),
                      }))
                    }
                  >
                    {key === "muted" ? "Unmute" : "Unblock"}
                  </button>
                </div>
              ))
            )}
          </section>
        ))}
        <h3>Following</h3>
        {state.following.map((handle) => (
          <div className="account-setting" key={handle}>
            <span>@{handle}</span>
            <button
              className="secondary"
              onClick={() =>
                update((s) => ({
                  ...s,
                  following: s.following.filter((h) => h !== handle),
                }))
              }
            >
              Unfollow
            </button>
          </div>
        ))}
        <p>
          {state.reports.length} local reports saved. Reports have not been sent
          to a moderator.
        </p>
      </details>
      <h2 className="results-title">Your posts & reposts</h2>
    </>
  );
}
