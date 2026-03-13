import { Grid, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

import type { ReviewRoadmapItem, ReviewRoadmapStage } from "@taxes/shared";

const STAGE_LABELS: Record<ReviewRoadmapStage, string> = {
  later: "Later",
  mvp: "MVP",
  next: "Next"
};

interface RoadmapBoardProps {
  readonly groupedRoadmap: Record<ReviewRoadmapStage, ReviewRoadmapItem[]>;
}

export function RoadmapBoard({ groupedRoadmap }: RoadmapBoardProps) {
  return (
    <Grid container spacing={2}>
      {(Object.keys(groupedRoadmap) as ReviewRoadmapStage[]).map((stage) => (
        <Grid key={stage} size={{ md: 4, xs: 12 }}>
          <Paper
            sx={(theme) => ({
              backgroundColor: getStageBackground(stage, theme),
              height: "100%",
              p: 2.5
            })}
            variant="outlined"
          >
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">{STAGE_LABELS[stage]}</Typography>
              {groupedRoadmap[stage].map((item) => (
                <Stack key={item.id} spacing={0.75}>
                  <Typography variant="h3">{item.title}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {item.summary}
                  </Typography>
                  <Typography variant="body2">{item.outcome}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function getStageBackground(stage: ReviewRoadmapStage, theme: Theme) {
  if (stage === "mvp") {
    return alpha(theme.palette.secondary.main, 0.1);
  }

  if (stage === "next") {
    return alpha(theme.palette.info.main, 0.07);
  }

  return alpha(theme.palette.primary.main, 0.04);
}
