import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import { Divider, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { ReviewLane } from "@taxes/shared";

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
        <Stack spacing={1}>
          <Typography variant="subtitle2">Questions To Answer</Typography>
          {lane.questions.map((question) => (
            <Paper
              key={question}
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
              <HelpOutlineOutlinedIcon color="secondary" fontSize="small" sx={{ mt: 0.2 }} />
              <Typography variant="body2">{question}</Typography>
            </Paper>
          ))}
        </Stack>
        <Divider />
        <Stack spacing={1}>
          <Typography variant="subtitle2">Evidence To Keep Visible</Typography>
          {lane.evidence.map((item) => (
            <Stack alignItems="flex-start" direction="row" key={item} spacing={1}>
              <CheckCircleOutlineOutlinedIcon color="info" fontSize="small" sx={{ mt: 0.2 }} />
              <Typography variant="body2">{item}</Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
