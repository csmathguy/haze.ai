import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import type { ReactNode } from "react";
import { Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CodeReviewChangedFile, ReviewLane } from "@taxes/shared";

interface LaneDetailPanelProps {
  readonly lane: ReviewLane;
}

export function LaneDetailPanel({ lane }: LaneDetailPanelProps) {
  return (
    <Paper sx={{ p: 3 }} variant="outlined">
      <Stack spacing={2}>
        <div>
          <Typography variant="subtitle2">Reviewer Goal</Typography>
          <Typography variant="h2">{lane.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }} variant="body1">
            {lane.reviewerGoal}
          </Typography>
        </div>
        <Divider />
        <LaneSection icon={<HelpOutlineOutlinedIcon color="secondary" fontSize="small" sx={{ mt: 0.2 }} />} items={lane.highlights} title="Highlights" useCards />
        <Divider />
        <LaneSection icon={<HelpOutlineOutlinedIcon color="secondary" fontSize="small" sx={{ mt: 0.2 }} />} items={lane.questions} title="Questions To Answer" />
        <Divider />
        <LaneSection icon={<CheckCircleOutlineOutlinedIcon color="info" fontSize="small" sx={{ mt: 0.2 }} />} items={lane.evidence} title="Evidence" />
        <Divider />
        <Stack spacing={1}>
          <Typography variant="subtitle2">Changed Files</Typography>
          {lane.files.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              No files were classified into this lane.
            </Typography>
          ) : (
            lane.files.map((file) => <LaneFileCard file={file} key={`${lane.id}-${file.path}`} />)
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function LaneSection({
  icon,
  items,
  title,
  useCards = false
}: {
  readonly icon: ReactNode;
  readonly items: string[];
  readonly title: string;
  readonly useCards?: boolean;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>
      {items.map((item) =>
        useCards ? (
          <Paper
            key={item}
            sx={(theme) => ({
              alignItems: "flex-start",
              backgroundColor: alpha(theme.palette.secondary.main, 0.05),
              borderColor: alpha(theme.palette.secondary.main, 0.3),
              display: "flex",
              gap: 1,
              p: 1.25
            })}
            variant="outlined"
          >
            {icon}
            <Typography variant="body2">{item}</Typography>
          </Paper>
        ) : (
          <Stack alignItems="flex-start" direction="row" key={item} spacing={1}>
            {icon}
            <Typography variant="body2">{item}</Typography>
          </Stack>
        )
      )}
    </Stack>
  );
}

function LaneFileCard({ file }: { readonly file: CodeReviewChangedFile }) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.primary.main, 0.03),
        borderColor: alpha(theme.palette.primary.main, 0.12),
        p: 1.5
      })}
      variant="outlined"
    >
      <Stack spacing={1}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1}>
            <FolderOpenOutlinedIcon color="primary" fontSize="small" sx={{ mt: 0.15 }} />
            <Typography variant="body2">{file.path}</Typography>
          </Stack>
          <Typography color="text.secondary" variant="body2">
            +{file.additions.toString()} / -{file.deletions.toString()}
          </Typography>
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip label={file.areaLabel} size="small" variant="outlined" />
          {file.tags.map((tag) => (
            <Chip key={`${file.path}-${tag}`} label={tag} size="small" variant="outlined" />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
