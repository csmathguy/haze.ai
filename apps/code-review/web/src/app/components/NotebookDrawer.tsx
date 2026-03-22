import { Drawer } from "@mui/material";

import type { ReviewNotebookEntry } from "../walkthrough.js";
import { ReviewNotebookPanel } from "./ReviewNotebookPanel.js";

interface NotebookDrawerProps {
  readonly entry: ReviewNotebookEntry;
  readonly isFinalStage: boolean;
  readonly laneTitle: string;
  readonly onChange: (patch: Partial<ReviewNotebookEntry>) => void;
  readonly onClose: () => void;
  readonly open: boolean;
}

export function NotebookDrawer({ entry, isFinalStage, laneTitle, onChange, onClose, open }: NotebookDrawerProps) {
  return (
    <Drawer
      anchor="right"
      onClose={onClose}
      open={open}
      sx={{
        "& .MuiDrawer-paper": {
          p: 2,
          width: { sm: 420, xs: "100%" }
        }
      }}
    >
      <ReviewNotebookPanel entry={entry} isFinalStage={isFinalStage} laneTitle={laneTitle} onChange={onChange} />
    </Drawer>
  );
}
