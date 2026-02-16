import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  cssVariables: {
    colorSchemeSelector: "data"
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#0B5FFF"
        },
        secondary: {
          main: "#1AA37A"
        },
        background: {
          default: "#F6F8FC",
          paper: "#FFFFFF"
        }
      }
    },
    dark: {
      palette: {
        primary: {
          main: "#7FB0FF"
        },
        secondary: {
          main: "#59D4AD"
        },
        background: {
          default: "#0D1424",
          paper: "#151F33"
        }
      }
    }
  },
  shape: {
    borderRadius: 16
  },
  typography: {
    fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
    h3: {
      fontWeight: 700,
      letterSpacing: "-0.02em"
    },
    h6: {
      fontWeight: 600
    },
    button: {
      textTransform: "none",
      fontWeight: 600
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 14
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(10px)"
        }
      }
    }
  }
});
