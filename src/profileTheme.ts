export type ProfileStyle = {
  css: string;
  layout: "classic" | "spotlight";
  pattern: "none" | "dots" | "stars";
  coverImage: string;
  tagline: string;
  song: string;
  album: string;
  quote: string;
  showFandoms: boolean;
  showStats: boolean;
  pinnedPostId: number | null;
};
export const themePresets = [
  {
    name: "Lavender",
    accent: "#7745d9",
    background: "#f7f1ff",
    surface: "#ffffff",
    text: "#32233f",
    muted: "#806c93",
    cover: "linear-gradient(120deg, #e8d3ff, #ccb3ee)",
    font: "system-ui",
  },
  {
    name: "Cherry pop",
    accent: "#c63a68",
    background: "#fff2f5",
    surface: "#ffffff",
    text: "#542c3a",
    muted: "#9b6d7e",
    cover: "linear-gradient(120deg, #ffbbd3, #ffddca)",
    font: "system-ui",
  },
  {
    name: "Sage diary",
    accent: "#45795b",
    background: "#f0f5ed",
    surface: "#ffffff",
    text: "#2b4132",
    muted: "#6d8474",
    cover: "linear-gradient(120deg, #b9d4a8, #dbe6c9)",
    font: "Georgia",
  },
  {
    name: "Midnight",
    accent: "#c5abff",
    background: "#251d35",
    surface: "#372947",
    text: "#f5ecff",
    muted: "#bfaed2",
    cover: "linear-gradient(120deg, #5b3a83, #302043)",
    font: "system-ui",
  },
  {
    name: "Golden hour",
    accent: "#a35c26",
    background: "#fff7e9",
    surface: "#fffdf8",
    text: "#543b2b",
    muted: "#957c62",
    cover: "linear-gradient(120deg, #ffd998, #f2bfa9)",
    font: "Georgia",
  },
  {
    name: "Digital blue",
    accent: "#3158bc",
    background: "#edf3ff",
    surface: "#ffffff",
    text: "#203451",
    muted: "#657a9c",
    cover: "linear-gradient(120deg, #a8ccff, #d1bfff)",
    font: "monospace",
  },
];
export function presetCss(preset = themePresets[0]) {
  return `:profile {\n  --profile-accent: ${preset.accent};\n  --profile-background: ${preset.background};\n  --profile-surface: ${preset.surface};\n  --profile-text: ${preset.text};\n  --profile-muted: ${preset.muted};\n  --profile-cover: ${preset.cover};\n  --profile-radius: 18px;\n  --profile-font: ${preset.font};\n}`;
}
export const defaultProfileStyle: ProfileStyle = {
  css: presetCss(),
  layout: "classic",
  pattern: "none",
  coverImage: "",
  tagline: "A little space for everything I love.",
  song: "",
  album: "",
  quote: "",
  showFandoms: true,
  showStats: true,
  pinnedPostId: null,
};
export function parseThemeCss(css: string): {
  values: Record<string, string>;
  error: string;
} {
  const values: Record<string, string> = {};
  if (css.length > 4000)
    return { values, error: "Keep your theme CSS under 4,000 characters." };
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    match = source.match(/^:profile\s*\{([^{}]*)\}\s*$/);
  if (!match)
    return {
      values,
      error:
        "Use a :profile { … } block containing the supported theme properties.",
    };
  for (const declaration of match[1]
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const colon = declaration.indexOf(":");
    if (colon < 1)
      return { values: {}, error: "Each property needs a colon and a value." };
    const key = declaration.slice(0, colon).trim(),
      value = declaration.slice(colon + 1).trim();
    if (/url\s*\(|var\s*\(|env\s*\(|expression|@|[<>{}]/i.test(value))
      return {
        values: {},
        error: "Remote resources and code are not supported in profile themes.",
      };
    if (
      [
        "--profile-accent",
        "--profile-background",
        "--profile-surface",
        "--profile-text",
        "--profile-muted",
      ].includes(key)
    ) {
      if (!CSS.supports("color", value))
        return { values: {}, error: key + " needs a valid CSS colour." };
    } else if (key === "--profile-cover") {
      if (
        !/^(linear|radial)-gradient\(/.test(value) ||
        !CSS.supports("background-image", value)
      )
        return {
          values: {},
          error: "The cover needs a linear-gradient or radial-gradient.",
        };
    } else if (key === "--profile-radius") {
      if (!/^(?:[0-9]|[12][0-9]|3[0-2])px$/.test(value))
        return {
          values: {},
          error: "Profile radius must be between 0px and 32px.",
        };
    } else if (key === "--profile-font") {
      if (!["system-ui", "Georgia", "monospace"].includes(value))
        return {
          values: {},
          error: "Choose system-ui, Georgia or monospace as your profile font.",
        };
    } else return { values: {}, error: "Unsupported property: " + key };
    values[key] = value;
  }
  return { values, error: "" };
}
