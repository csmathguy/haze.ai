export const colorTokens = {
  accent: "#9c4618",
  accentSoft: "#f1d2bf",
  background: {
    default: "#f5efe7",
    paper: "#fffaf4",
    raised: "#f0e4d7"
  },
  border: {
    strong: "#b78e72",
    subtle: "#ddc4b1"
  },
  hero: {
    end: "#b76534",
    start: "#213b45"
  },
  ink: "#19343d",
  muted: "#5f5850",
  signal: {
    caution: "#9f4a26",
    focus: "#1f7168",
    success: "#2f6d53"
  }
} as const;

export const shapeTokens = {
  borderRadius: 24
} as const;

export const typographyTokens = {
  bodyFontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif',
  headingFontFamily: '"Rockwell", "Aptos Display", "Georgia", serif',
  monoFontFamily: '"Cascadia Mono", "Consolas", monospace'
} as const;
