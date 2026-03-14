import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";

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
        const status = getLaneStatus(lane, isSelected);
        const usesRiskEmphasis = lane.id === "risks" && lane.files.length > 0 && !isSelected;
        const buttonColor = getButtonColor(isSelected, usesRiskEmphasis);

        return (
          <Paper
            key={lane.id}
            sx={(theme) => ({
              backgroundColor: getLaneBackgroundColor(theme, isSelected, usesRiskEmphasis),
              borderColor: getLaneBorderColor(theme, isSelected, usesRiskEmphasis),
              borderLeftWidth: isSelected ? 6 : 1,
              borderWidth: 1,
              p: 2.25
            })}
            variant="outlined"
          >
            <Stack spacing={1.25}>
              <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="h3">{lane.title}</Typography>
                <Chip color={status.color} label={status.label} size="small" variant={isSelected ? "filled" : "outlined"} />
              </Stack>
              <Typography color="text.secondary" variant="body2">
                {lane.summary}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip label={`${lane.files.length.toString()} files`} size="small" variant="outlined" />
                <Chip label={summarizeLaneHighlights(lane)} size="small" variant="outlined" />
                <Chip label={summarizeLaneEvidence(lane)} size="small" sx={{ color: "text.secondary" }} variant="outlined" />
              </Stack>
              <Button
                color={buttonColor}
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

function getLaneBackgroundColor(theme: Theme, isSelected: boolean, usesRiskEmphasis: boolean): string {
  if (isSelected) {
    return alpha(theme.palette.secondary.main, 0.08);
  }

  if (usesRiskEmphasis) {
    return alpha(theme.palette.warning.main, 0.08);
  }

  return theme.palette.background.paper;
}

function getLaneBorderColor(theme: Theme, isSelected: boolean, usesRiskEmphasis: boolean): string {
  if (isSelected) {
    return alpha(theme.palette.secondary.main, 0.6);
  }

  if (usesRiskEmphasis) {
    return alpha(theme.palette.warning.main, 0.5);
  }

  return alpha(theme.palette.divider, 0.9);
}

function getLaneStatus(lane: ReviewLane, isSelected: boolean): { readonly color: "primary" | "secondary" | "warning"; readonly label: string } {
  if (isSelected) {
    return { color: "secondary", label: "Reviewing now" };
  }

  if (lane.id === "risks" && lane.files.length > 0) {
    return { color: "warning", label: "Review first" };
  }

  if (lane.id === "docs") {
    return { color: "primary", label: "Reference" };
  }

  return { color: "primary", label: "Ready" };
}

function summarizeLaneHighlights(lane: ReviewLane): string {
  if (lane.highlights.length === 0) {
    return "No highlights";
  }

  return lane.highlights[0] ?? "No highlights";
}

function getButtonColor(isSelected: boolean, usesRiskEmphasis: boolean): "primary" | "secondary" | "warning" {
  if (usesRiskEmphasis) {
    return "warning";
  }

  if (isSelected) {
    return "secondary";
  }

  return "primary";
}
