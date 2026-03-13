export const colorTokens = {
  accent: "#b4653b",
  background: {
    default: "#f3ede3",
    paper: "#fff9f0"
  },
  border: "#d4c4aa",
  highlight: "#2d7f78",
  ink: "#17363d",
  muted: "#6b6b65",
  signal: {
    failed: "#b34b3f",
    running: "#b27d28",
    success: "#2f7a54"
  }
} as const;

export const shapeTokens = {
  borderRadius: 20
} as const;

export const typographyTokens = {
  bodyFontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", sans-serif',
  headingFontFamily: '"Bahnschrift", "Aptos Display", "Segoe UI Variable Display", sans-serif',
  monoFontFamily: '"Cascadia Mono", "Consolas", monospace'
} as const;
