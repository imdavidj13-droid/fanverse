export type Draft = {
  text: string;
  fandom: string;
  alt: string;
  poll: string[] | null;
  spoiler: boolean;
  hadImage: boolean;
};
export const draftKey = (key: string) => "fanverse.draft.v1." + key;
export function readDraft(key: string, fandom: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(key));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value.text !== "string" || value.text.length > 500) return null;
    return {
      text: value.text,
      fandom: ["taylor", "sabrina", "olivia", "screen"].includes(value.fandom)
        ? value.fandom
        : fandom,
      alt: typeof value.alt === "string" ? value.alt.slice(0, 200) : "",
      poll:
        Array.isArray(value.poll) &&
        value.poll.length >= 2 &&
        value.poll.length <= 4 &&
        value.poll.every(
          (s: unknown) => typeof s === "string" && s.length <= 60,
        )
          ? value.poll
          : null,
      spoiler: Boolean(value.spoiler),
      hadImage: Boolean(value.hadImage),
    };
  } catch {
    return null;
  }
}
