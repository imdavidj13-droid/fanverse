import { useId, useState } from "react";
import { ImagePlus, BarChart3, X, EyeOff } from "lucide-react";
import { fandoms, type Post } from "./data";
import type { Profile } from "./model";
export function Avatar({ profile }: { profile: Profile }) {
  return (
    <span className="avatar me">
      {profile.avatar ? (
        <img src={profile.avatar} alt="" />
      ) : (
        profile.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
export function Composer({
  profile,
  onPublish,
  onNotice,
  initialFandom = "taylor",
}: {
  profile: Profile;
  onPublish: (post: Post) => void;
  onNotice: (message: string) => void;
  initialFandom?: string;
}) {
  const [text, setText] = useState(""),
    [fandom, setFandom] = useState(initialFandom),
    [image, setImage] = useState(""),
    [alt, setAlt] = useState(""),
    [poll, setPoll] = useState<string[] | null>(null),
    [spoiler, setSpoiler] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const imageId = useId();
  const reportError = (message: string) => {
    setError(message);
    onNotice(message);
  };
  const valid =
    Boolean(text.trim() || image) &&
    (!poll ||
      (poll.every((option) => option.trim()) &&
        new Set(poll.map((o) => o.trim().toLowerCase())).size === poll.length));
  const publish = () => {
    if (!valid || loading) return;
    onPublish({
      id: Date.now(),
      author: profile.name,
      handle: "david",
      avatar: profile.name.slice(0, 1),
      fandom,
      text: text.trim(),
      likes: 0,
      following: true,
      own: true,
      ...(image ? { image, imageAlt: alt.trim() } : {}),
      ...(poll
        ? { poll: poll.map((o) => o.trim()), pollCounts: poll.map(() => 0) }
        : {}),
      spoiler,
      createdAt: new Date().toISOString(),
    });
    setText("");
    setImage("");
    setAlt("");
    setPoll(null);
    setSpoiler(false);
  };
  return (
    <div className={"composer " + (text.length ? "has-draft" : "")}>
      <div className="compose-row">
        <Avatar profile={profile} />
        <textarea
          aria-label="Write a post"
          maxLength={500}
          placeholder="What’s on your mind, fellow fan?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {image && (
        <div className="attachment">
          <img src={image} alt={alt || "Attached photo preview"} />
          <button
            aria-label="Remove attached photo"
            onClick={() => {
              setImage("");
              setAlt("");
            }}
          >
            <X size={17} />
          </button>
          <input
            aria-label="Photo description"
            maxLength={200}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe the photo for accessibility…"
          />
        </div>
      )}
      {poll && (
        <div className="poll-editor">
          <div>
            <strong>Create a poll</strong>
            <button aria-label="Remove poll" onClick={() => setPoll(null)}>
              <X size={16} />
            </button>
          </div>
          {poll.map((value, i) => (
            <input
              key={i}
              aria-label={`Poll option ${i + 1}`}
              maxLength={60}
              placeholder={`Option ${i + 1}`}
              value={value}
              onChange={(e) =>
                setPoll(poll.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
          ))}
          {poll.length < 4 && (
            <button
              className="text-button"
              onClick={() => setPoll([...poll, ""])}
            >
              + Add option
            </button>
          )}
          <small>
            2–4 different options. No end date in this local preview.
          </small>
        </div>
      )}
      <div className="compose-tools">
        <label
          className={"tool-button " + (poll ? "disabled" : "")}
          htmlFor={imageId}
          title="Attach a photo"
        >
          <ImagePlus size={17} />
          <span>Photo</span>
        </label>
        <input
          id={imageId}
          className="file-input"
          aria-label="Attach a photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={Boolean(poll) || loading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (
              !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
                file.type,
              ) ||
              file.size > 750000
            ) {
              reportError(
                "Choose a JPG, PNG, WebP or GIF under 750 KB for this local preview.",
              );
              return;
            }
            setError("");
            setLoading(true);
            try {
              const result = await readImage(file);
              setImage(result);
            } catch {
              reportError("This photo could not be read. Please try another.");
            } finally {
              setLoading(false);
            }
          }}
        />
        <button
          className="tool-button"
          disabled={Boolean(image)}
          aria-pressed={Boolean(poll)}
          onClick={() => setPoll(poll ? null : ["", ""])}
        >
          <BarChart3 size={17} />
          <span>Poll</span>
        </button>
        <button
          className={"tool-button " + (spoiler ? "selected" : "")}
          aria-pressed={spoiler}
          aria-label="Mark as spoiler"
          onClick={() => setSpoiler(!spoiler)}
        >
          <EyeOff size={17} />
        </button>
        <select
          aria-label="Post fandom"
          value={fandom}
          onChange={(e) => setFandom(e.target.value)}
        >
          {fandoms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          className="primary"
          disabled={!valid || loading}
          onClick={publish}
        >
          {loading ? "Reading…" : "Post"}
        </button>
      </div>
      {error && (
        <p className="composer-error" role="alert">
          {error}
        </p>
      )}
      <small>
        {text.length}/500 · {spoiler ? "Spoiler warning on · " : ""}Saved on
        this browser only
      </small>
    </div>
  );
}
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      const image = new window.Image();
      image.onload = () => resolve(value);
      image.onerror = reject;
      image.src = value;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
