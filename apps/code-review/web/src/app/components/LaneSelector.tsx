import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { ReviewLane } from "@taxes/shared";

import { summarizeLaneEvidence } from "../index.js";

interface LaneSelectorProps {
  readonly lanes: ReviewLane[];
  readonly onSelect: (laneId: ReviewLane["id"]) => void;
  readonly selectedLaneId: ReviewLane["id"];
}

export function LaneSelector({ lanes, onSelect, selectedLaneId }: LaneSelectorProps) {
  return (
    <Stack spacing={1.5}>
      {lanes.map((lane) => {
        const isSelected = lane.id === selectedLaneId;

        return (
          <Paper
            key={lane.id}
            sx={(theme) => ({
              backgroundColor: isSelected ? alpha(theme.palette.secondary.main, 0.08) : theme.palette.background.paper,
              borderColor: isSelected ? alpha(theme.palette.secondary.main, 0.6) : alpha(theme.palette.divider, 0.9),
              borderLeftWidth: isSelected ? 6 : 1,
              borderWidth: 1,
              p: 2.25
            })}
            variant="outlined"
          >
            <Stack spacing={1.25}>
              <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="h3">{lane.title}</Typography>
                <Chip color={isSelected ? "secondary" : "primary"} label={isSelected ? "Reviewing now" : "Ready"} size="small" variant={isSelected ? "filled" : "outlined"} />
              </Stack>
              <Typography color="text.secondary" variant="body2">
                {lane.summary}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip label={`${lane.evidence.length.toString()} evidence`} size="small" variant="outlined" />
                <Chip label={`${lane.questions.length.toString()} questions`} size="small" variant="outlined" />
                <Chip label={summarizeLaneEvidence(lane)} size="small" sx={{ color: "text.secondary" }} variant="outlined" />
              </Stack>
              <Button
                color={isSelected ? "secondary" : "primary"}
                onClick={() => {
                  onSelect(lane.id);
                }}
                variant={isSelected ? "contained" : "outlined"}
              >
                {isSelected ? "Selected lane" : "Open lane"}
              </Button>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
