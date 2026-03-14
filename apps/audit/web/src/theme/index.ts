import { createTheme } from "@mui/material/styles";

import { colorTokens, shapeTokens, typographyTokens } from "./tokens.js";

export const auditTheme = createTheme({
  components: {
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    }
  },
  cssVariables: true,
  palette: {
    background: colorTokens.background,
    error: {
      main: colorTokens.signal.failed
    },
    primary: {
      main: colorTokens.ink
    },
    secondary: {
      main: colorTokens.accent
    },
    success: {
      main: colorTokens.signal.success
    },
    warning: {
      main: colorTokens.signal.running
    }
  },
  shape: {
    borderRadius: shapeTokens.borderRadius
  },
  typography: {
    fontFamily: typographyTokens.bodyFontFamily,
    body2: {
      lineHeight: 1.55
    },
    h1: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "clamp(2.1rem, 3.4vw, 2.55rem)",
      fontWeight: 700,
      letterSpacing: "-0.025em",
      lineHeight: 1.05
    },
    h2: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "clamp(1.45rem, 2.2vw, 1.8rem)",
      fontWeight: 700,
      lineHeight: 1.1
    },
    h3: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "1.08rem",
      fontWeight: 700,
      lineHeight: 1.18
    },
    subtitle2: {
      fontFamily: typographyTokens.monoFontFamily,
      fontSize: "0.74rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }
  }
});
