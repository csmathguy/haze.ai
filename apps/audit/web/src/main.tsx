import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";

import { App } from "./app/App.js";
import { auditTheme } from "./theme/index.js";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={auditTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
