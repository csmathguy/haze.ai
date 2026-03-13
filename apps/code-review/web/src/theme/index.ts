import { alpha, createTheme } from "@mui/material/styles";

import { colorTokens, shapeTokens, typographyTokens } from "./tokens.js";

export const codeReviewTheme = createTheme({
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          "&.Mui-focusVisible": {
            outline: `3px solid ${alpha(colorTokens.signal.focus, 0.75)}`,
            outlineOffset: 2
          },
          borderRadius: 999,
          fontWeight: 700,
          textTransform: "none"
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          "& .MuiChip-icon": {
            color: "inherit"
          },
          borderRadius: 999,
          fontWeight: 700
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${alpha(colorTokens.border.strong, 0.22)}`,
          boxShadow: "none"
        }
      }
    }
  },
  cssVariables: true,
  palette: {
    background: colorTokens.background,
    divider: alpha(colorTokens.border.strong, 0.38),
    info: {
      main: colorTokens.signal.focus
    },
    primary: {
      contrastText: colorTokens.background.paper,
      main: colorTokens.ink
    },
    secondary: {
      contrastText: colorTokens.background.paper,
      main: colorTokens.accent
    },
    success: {
      main: colorTokens.signal.success
    },
    text: {
      primary: colorTokens.ink,
      secondary: colorTokens.muted
    },
    warning: {
      main: colorTokens.signal.caution
    }
  },
  shape: {
    borderRadius: shapeTokens.borderRadius
  },
  typography: {
    fontFamily: typographyTokens.bodyFontFamily,
    body1: {
      lineHeight: 1.55
    },
    body2: {
      lineHeight: 1.55
    },
    h1: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "2.95rem",
      fontWeight: 700,
      letterSpacing: "-0.04em"
    },
    h2: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "2.45rem",
      fontWeight: 700
    },
    h3: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "1.55rem",
      fontWeight: 700
    },
    subtitle2: {
      fontFamily: typographyTokens.monoFontFamily,
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }
  }
});
