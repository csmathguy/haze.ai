import { createTheme } from "@mui/material/styles";

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
          backgroundImage: "none"
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          minHeight: 48,
          textTransform: "none"
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
      main: colorTokens.secondary
    },
    success: {
      main: colorTokens.success
    }
  },
  shape: {
    borderRadius: shapeTokens.borderRadius
  },
  typography: {
    fontFamily: typographyTokens.bodyFontFamily,
    h1: {
      fontFamily: typographyTokens.headingFontFamily,
      fontSize: "2.8rem"
    },
    h2: {
      fontFamily: typographyTokens.headingFontFamily
    },
    h3: {
      fontFamily: typographyTokens.headingFontFamily
    }
  }
});
