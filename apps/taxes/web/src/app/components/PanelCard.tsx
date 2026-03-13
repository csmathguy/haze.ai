import type { PropsWithChildren } from "react";
import type { PaperProps } from "@mui/material";
import { Paper } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

const PanelCardRoot = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
  padding: theme.spacing(3)
}));

export function PanelCard({ children, elevation = 0, ...props }: PropsWithChildren<PaperProps>) {
  return (
    <PanelCardRoot elevation={elevation} {...props}>
      {children}
    </PanelCardRoot>
  );
}
