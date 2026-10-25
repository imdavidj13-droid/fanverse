import "./profile.css";
import { useState, type CSSProperties, type ReactNode } from "react";
import { fandoms } from "./data";
import { Avatar, readImage } from "./Composer";
import type { State } from "./model";
import { AppLink } from "./Navigation";
import { navigate } from "./routes";
import {
  themePresets,
  presetCss,
  parseThemeCss,
  type ProfileStyle,
} from "./profileTheme";
export function ProfileHeader({
  state,
  style = state.profileStyle,
  children,
}: {
  state: State;
  style?: ProfileStyle;
  children?: ReactNode;
}) {
  const parsed = parseThemeCss(style.css),
    pin = state.posts.find(
      (p) =>
        p.own &&
        p.id === style.pinnedPostId &&
        !state.preferences.mutedWords.some((word) =>
          p.text.toLowerCase().includes(word.toLowerCase()),
        ),
    );
  return (
    <section
      className={"custom-profile profile-layout-" + style.layout}
      style={parsed.values as CSSProperties}
    >
      <div className={"profile-cover pattern-" + style.pattern}>
        {style.coverImage && <img src={style.coverImage} alt="Profile cover" />}
      </div>
      <div className="profile-body">
        <Avatar profile={state.profile} />
        <h2>{state.profile.name}</h2>
        <p className="profile-handle">@david · Local preview profile</p>
        {style.tagline && <p className="profile-tagline">{style.tagline}</p>}
        <p className="profile-bio">{state.profile.bio}</p>
        {style.showStats && (
          <div className="profile-stats">
            {state.joined.length} fandoms · {state.following.length} following ·{" "}
            {state.posts.filter((p) => p.own).length}{" "}
            {state.posts.filter((p) => p.own).length === 1 ? "post" : "posts"}
          </div>
        )}
        {style.showFandoms && (
          <div className="profile-badges">
            {fandoms
              .filter((f) => state.joined.includes(f.id))
              .map((f) => (
                <AppLink
                  key={f.id}
                  href={
                    "/fandoms/" +
                    {
                      taylor: "taylor-swift",
                      sabrina: "sabrina-carpenter",
                      olivia: "olivia-rodrigo",
                      screen: "tv-and-film",
                    }[f.id]
                  }
                >
                  {f.symbol} {f.name}
                </AppLink>
              ))}
          </div>
        )}
        {(style.song || style.album) && (
          <div className="profile-favourites">
            {style.song && (
              <div>
                <small>ON REPEAT</small>
                <strong>♫ {style.song}</strong>
              </div>
            )}
            {style.album && (
              <div>
                <small>FAVOURITE ALBUM</small>
                <strong>◉ {style.album}</strong>
              </div>
            )}
          </div>
        )}
        {style.quote && <blockquote>{style.quote}</blockquote>}
        {pin && (
          <AppLink className="profile-pin" href={"/posts/" + pin.id}>
            ⌁ Pinned conversation:{" "}
            {pin.spoiler && state.preferences.hideSpoilers
              ? "Spoiler post"
              : pin.text.slice(0, 80) || "Photo post"}
          </AppLink>
        )}
        {children}
      </div>
    </section>
  );
}
export function ProfileStudio({
  state,
  update,
  onNotice,
}: {
  state: State;
  update: (fn: (s: State) => State) => void;
  onNotice: (s: string) => void;
}) {
  const [draft, setDraft] = useState(state.profileStyle),
    [tab, setTab] = useState("Design"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const parsed = parseThemeCss(draft.css),
    set = (patch: Partial<ProfileStyle>) =>
      setDraft((d) => ({ ...d, ...patch }));
  function setProperty(key: string, value: string) {
    const source = draft.css;
    const expression = new RegExp(key.replaceAll("-", "\\-") + "\\s*:[^;]*;");
    set({
      css: expression.test(source)
        ? source.replace(expression, key + ": " + value + ";")
        : source.replace(/}\s*$/, `  ${key}: ${value};\n}`),
    });
  }
  return (
    <>
      <div className="local-page-title">
        <AppLink href="/profile">← Back to your profile</AppLink>
        <h1>Profile studio</h1>
        <p>
          Make this space yours. Your theme is saved on this browser until
          shared profiles are connected.
        </p>
      </div>
      <div className="studio-toolbar">
        <button
          className="primary"
          disabled={Boolean(parsed.error) || busy}
          onClick={() => {
            update((s) => ({ ...s, profileStyle: draft }));
            onNotice("Your profile theme has been saved on this browser.");
            navigate("/profile");
          }}
        >
          Save profile theme
        </button>
        <AppLink className="secondary" href="/profile">
          Cancel
        </AppLink>
      </div>
      <nav className="explore-tabs" aria-label="Profile editor sections">
        {["Design", "Details", "Theme CSS"].map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            className={tab === name ? "selected" : ""}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="profile-studio">
        <div className="studio-controls">
          {tab === "Design" ? (
            <>
              <section className="settings-card">
                <h2>Start with a theme</h2>
                <div className="theme-presets">
                  {themePresets.map((theme) => (
                    <button
                      key={theme.name}
                      onClick={() => set({ css: presetCss(theme) })}
                    >
                      <span style={{ background: theme.cover }} />
                      <strong>{theme.name}</strong>
                    </button>
                  ))}
                </div>
              </section>
              <section className="settings-card">
                <h2>Colours & typography</h2>
                {[
                  ["--profile-accent", "Accent"],
                  ["--profile-background", "Background"],
                  ["--profile-surface", "Card colour"],
                  ["--profile-text", "Text"],
                  ["--profile-muted", "Secondary text"],
                ].map(([key, label]) => (
                  <label className="theme-colour" key={key}>
                    {label}
                    <input
                      type="color"
                      aria-label={label + " colour"}
                      value={
                        /^#[0-9a-f]{6}$/i.test(parsed.values[key] || "")
                          ? parsed.values[key]
                          : "#7745d9"
                      }
                      onChange={(e) => setProperty(key, e.target.value)}
                    />
                  </label>
                ))}
                <label className="studio-field">
                  Font
                  <select
                    value={parsed.values["--profile-font"] || "system-ui"}
                    onChange={(e) =>
                      setProperty("--profile-font", e.target.value)
                    }
                  >
                    <option value="system-ui">Clean & modern</option>
                    <option value="Georgia">Diary serif</option>
                    <option value="monospace">Digital mono</option>
                  </select>
                </label>
                <label className="studio-field">
                  Corner rounding
                  <input
                    type="range"
                    min={0}
                    max={32}
                    value={Number(
                      (parsed.values["--profile-radius"] || "18px").replace(
                        "px",
                        "",
                      ),
                    )}
                    onChange={(e) =>
                      setProperty("--profile-radius", e.target.value + "px")
                    }
                  />
                </label>
              </section>
              <section className="settings-card live-form">
                <h2>Cover & layout</h2>
                <label>
                  Profile layout
                  <select
                    value={draft.layout}
                    onChange={(e) =>
                      set({ layout: e.target.value as ProfileStyle["layout"] })
                    }
                  >
                    <option value="classic">Classic</option>
                    <option value="spotlight">Centred spotlight</option>
                  </select>
                </label>
                <label>
                  Cover pattern
                  <select
                    value={draft.pattern}
                    onChange={(e) =>
                      set({
                        pattern: e.target.value as ProfileStyle["pattern"],
                      })
                    }
                  >
                    <option value="none">Plain gradient</option>
                    <option value="dots">Confetti dots</option>
                    <option value="stars">Fandom stars</option>
                  </select>
                </label>
                <label>
                  Cover photo (JPG, PNG or WebP, under 250 KB)
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
                        setError("Choose a JPG, PNG or WebP under 250 KB.");
                        return;
                      }
                      setBusy(true);
                      setError("");
                      try {
                        set({ coverImage: await readImage(file) });
                      } catch {
                        setError("This photo could not be read.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                {draft.coverImage && (
                  <button
                    className="secondary"
                    onClick={() => set({ coverImage: "" })}
                  >
                    Remove cover photo
                  </button>
                )}
              </section>
            </>
          ) : tab === "Details" ? (
            <section className="settings-card live-form">
              <h2>The things you love</h2>
              {(
                [
                  ["tagline", "Profile tagline", 100],
                  ["song", "Song on repeat", 100],
                  ["album", "Favourite album", 100],
                  ["quote", "Favourite quote", 200],
                ] as const
              ).map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <input
                    maxLength={max}
                    value={draft[key]}
                    onChange={(e) => set({ [key]: e.target.value })}
                  />
                </label>
              ))}
              <label>
                Pin one of your posts
                <select
                  value={draft.pinnedPostId || ""}
                  onChange={(e) =>
                    set({
                      pinnedPostId: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">No pinned post</option>
                  {state.posts
                    .filter((p) => p.own)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.text.slice(0, 60) || "Photo post"}
                      </option>
                    ))}
                </select>
              </label>
              <label className="setting-toggle">
                <span>Show fandom badges</span>
                <input
                  type="checkbox"
                  checked={draft.showFandoms}
                  onChange={(e) => set({ showFandoms: e.target.checked })}
                />
              </label>
              <label className="setting-toggle">
                <span>Show profile statistics</span>
                <input
                  type="checkbox"
                  checked={draft.showStats}
                  onChange={(e) => set({ showStats: e.target.checked })}
                />
              </label>
            </section>
          ) : (
            <section className="settings-card live-form">
              <h2>Theme CSS</h2>
              <p>
                Edit the supported properties inside <code>:profile</code>. They
                style only your profile. Colours, gradient covers, corner
                rounding and the three font families are supported.
              </p>
              <label>
                Profile theme CSS
                <textarea
                  className="css-editor"
                  spellCheck={false}
                  maxLength={4000}
                  value={draft.css}
                  onChange={(e) => set({ css: e.target.value })}
                />
              </label>
              <small>
                Selectors, scripts, remote URLs and extra properties are not
                supported. Add a cover photo using the Design tab.
              </small>
            </section>
          )}
          {(parsed.error || error) && (
            <p role="alert" className="composer-error">
              {parsed.error || error}
            </p>
          )}
        </div>
        <div className="studio-preview">
          <div className="preview-label">LIVE PROFILE PREVIEW</div>
          <ProfileHeader
            state={state}
            style={{
              ...draft,
              css: parsed.error ? state.profileStyle.css : draft.css,
            }}
          />
          <p className="local-explainer">
            Your changes take effect when you save. The rest of the site keeps
            its white theme.
          </p>
        </div>
      </div>
    </>
  );
}
