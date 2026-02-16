import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import { IconButton, Tooltip } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";

export function ModeToggle() {
  const { mode, setMode } = useColorScheme();

  if (!mode) {
    return null;
  }

  const isDark = mode === "dark";

  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton
        aria-label="Toggle color mode"
        color="primary"
        onClick={() => setMode(isDark ? "light" : "dark")}
      >
        {isDark ? <LightModeRounded /> : <DarkModeRounded />}
      </IconButton>
    </Tooltip>
  );
}
