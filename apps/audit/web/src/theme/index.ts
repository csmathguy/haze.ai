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
    h1: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "3rem",
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    h2: {
      fontFamily: typographyTokens.headingFontFamily,
      fontWeight: 700
    },
    h3: {
      fontFamily: typographyTokens.headingFontFamily,
      fontWeight: 700
    },
    subtitle2: {
      fontFamily: typographyTokens.monoFontFamily,
      fontSize: "0.76rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }
  }
});
