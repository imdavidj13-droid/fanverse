import { useState } from "react";
import { readImage } from "./Composer";
import { filterPosts, type State } from "./model";
import { AppLink } from "./Navigation";
import { useRoute, navigate, fandomPath } from "./routes";
import { PostCard } from "./PostCard";
import { Image, MessageCircle, Paintbrush, Pin, Settings, Sparkles } from "lucide-react";
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
      <ProfileHeader state={state} compact>
        <div className="compact-profile-actions">
        <button
          className="secondary"
          onClick={() => {
            setDraft(state.profile);
            setEditing(!editing);
          }}
        >
          Edit profile
        </button>
        <a className="secondary profile-settings-link" href="/settings" aria-label="Profile preferences" title="Profile preferences">
          <Settings size={14}/>
        </a>
        <a className="secondary profile-settings-link" href="/profile/edit" aria-label="Customise profile theme" title="Customise profile theme">
          <Paintbrush size={14}/>
        </a>
        </div>
      </ProfileHeader>
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
      <div className="profile-summary-note">Your local profile · Posts and customisation stay in this browser.</div>
    </>
  );
}
export function ProfilePreferences({state,update}:{state:State;update:(fn:(s:State)=>State)=>void}) {
  return <details className="preferences">
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
      </details>;
}

export function ProfilePage({state,update,onNotice,onCompose}:{state:State;update:(fn:(s:State)=>State)=>void;onNotice:(message:string)=>void;onCompose:()=>void}) {
  useRoute();
  const view=new URLSearchParams(location.search).get('tab')||'posts';
  const tab=['posts','media','reposts','about'].includes(view)?view:'posts';
  const visible=filterPosts(state,{page:'Profile',tab:'For you',fandom:'',query:''}).filter(p=>tab==='reposts'?state.reposted.includes(p.id):p.own&&(tab!=='media'||Boolean(p.image||p.art)));
  const ordered=[...visible].sort((a,b)=>Number(b.id===state.profileStyle.pinnedPostId)-Number(a.id===state.profileStyle.pinnedPostId)||b.id-a.id);
  return <section className="profile-page"><h1 className="sr-only">Your profile</h1><ProfilePanel state={state} update={update} onNotice={onNotice}/><nav className="profile-content-tabs" aria-label="Profile content">{[['posts','Posts'],['media','Media'],['reposts','Reposts'],['about','About']].map(([id,label])=><AppLink key={id} className={tab===id?'selected':''} aria-current={tab===id?'page':undefined} href={'/profile'+(id==='posts'?'':'?tab='+id)}>{label}</AppLink>)}</nav>
    {tab==='about'?<ProfileAbout state={state} update={update}/>:<><div className="profile-feed-heading"><h2>{tab==='media'?'Your photos & art':tab==='reposts'?'Conversations you’ve shared':'Your conversations'}</h2><span>{ordered.length}</span></div>{ordered.map(p=><div key={p.id}>{p.own&&p.id===state.profileStyle.pinnedPostId&&<p className="profile-pinned-label"><Pin size={12}/> Pinned post</p>}<PostCard post={p} state={state} update={update} onCommunity={()=>navigate(fandomPath(p.fandom))} onNotice={onNotice}/></div>)}{!ordered.length&&<div className="profile-feed-empty">{tab==='media'?<Image size={27}/>:<MessageCircle size={27}/>}<h2>{tab==='media'?'A home for your creativity':tab==='reposts'?'Keep the conversation going':'Your first post starts here'}</h2><p>{tab==='media'?'Photos you add to your own posts appear here.':tab==='reposts'?'Repost a conversation you love and it will appear in this tab.':'Share a thought, a question or your latest fandom obsession.'}</p><button className="primary" onClick={onCompose}>Create a post</button></div>}</>}
  </section>;
}
export function ProfileAbout({state,update}:{state:State;update:(fn:(s:State)=>State)=>void}) {
 const style=state.profileStyle;
 return <div className="profile-about-content"><section className="profile-about-card"><div className="profile-about-heading"><Sparkles size={19}/><h2>A little more about me</h2><AppLink href="/profile/edit?section=details">Edit details ↗</AppLink></div><p>{style.tagline||state.profile.bio||'Make this space your own with a tagline and a few favourites.'}</p>{style.song||style.album?<div className="profile-about-favourites">{style.song&&<article><span>♫</span><small>ON REPEAT</small><h3>{style.song}</h3></article>}{style.album&&<article><span>◉</span><small>FAVOURITE ALBUM</small><h3>{style.album}</h3></article>}</div>:<div className="profile-favourites-prompt"><h3>What’s your current obsession?</h3><p>Add your song on repeat, favourite album and a quote in the profile studio.</p><AppLink className="secondary" href="/profile/edit?section=details">Add your favourites</AppLink></div>}{style.quote&&<blockquote>{style.quote}</blockquote>}</section><section className="profile-about-card"><div className="profile-about-heading"><Paintbrush size={18}/><h2>Make it yours</h2></div><p>Your theme, cover, typography and pinned post are managed in the profile studio.</p><AppLink className="secondary" href="/profile/edit">Open profile studio</AppLink></section><ProfilePreferences state={state} update={update}/></div>;
}
