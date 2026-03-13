import { alpha, createTheme } from "@mui/material/styles";

import { colorTokens, shapeTokens, typographyTokens } from "./tokens.js";

export const appTheme = createTheme({
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          textTransform: "none"
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${alpha(colorTokens.primary, 0.08)}`
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        label: {
          fontSize: "0.72rem",
          fontWeight: 500,
          paddingLeft: 8,
          paddingRight: 8
        },
        root: {
          height: 26
        }
      }
    }
  },
  cssVariables: true,
  palette: {
    background: colorTokens.background,
    primary: {
      main: colorTokens.primary
    },
    secondary: {
      main: colorTokens.accent
    },
    success: {
      main: colorTokens.success
    },
    warning: {
      main: colorTokens.warning
    }
  },
  shape: {
    borderRadius: shapeTokens.borderRadius
  },
  typography: {
    fontFamily: typographyTokens.bodyFontFamily,
    body1: {
      fontSize: "0.95rem",
      lineHeight: 1.45
    },
    body2: {
      fontSize: "0.82rem",
      lineHeight: 1.45
    },
    button: {
      fontSize: "0.9rem",
      fontWeight: 600,
      lineHeight: 1.2
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.35
    },
    h1: {
      fontFamily: typographyTokens.bodyFontFamily,
      fontSize: "2rem",
      fontWeight: 600,
      letterSpacing: "-0.03em",
      lineHeight: 1.08
    },
    h2: {
      fontFamily: typographyTokens.bodyFontFamily,
      fontSize: "1.35rem",
      fontWeight: 600,
      letterSpacing: "-0.02em",
      lineHeight: 1.15
    },
    h3: {
      fontFamily: typographyTokens.bodyFontFamily,
      fontSize: "1rem",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.22
    },
    h4: {
      fontFamily: typographyTokens.bodyFontFamily,
      fontSize: "0.92rem",
      fontWeight: 600,
      letterSpacing: "0.01em",
      lineHeight: 1.25
    },
    h5: {
      fontFamily: typographyTokens.bodyFontFamily,
      fontSize: "0.8rem",
      fontWeight: 600,
      letterSpacing: "0.02em",
      lineHeight: 1.25
    },
    subtitle1: {
      fontSize: "0.95rem",
      fontWeight: 600,
      lineHeight: 1.3
    }
  }
});
