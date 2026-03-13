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
    h1: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "2.6rem"
    },
    h2: {
      fontFamily: typographyTokens.headingFontFamily
    },
    h3: {
      fontFamily: typographyTokens.headingFontFamily
    }
  }
});
