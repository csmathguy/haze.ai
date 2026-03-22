import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import { Accordion, AccordionDetails, AccordionSummary, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CodeReviewPullRequestDetail, ReviewLane } from "@taxes/shared";

import { buildLaneNarrativePresentation } from "../pull-request-story.js";
import type { ReviewStagePresentation } from "../review-stage.js";

interface WalkthroughNarrativePanelProps {
  readonly lane: ReviewLane;
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly stagePresentation: ReviewStagePresentation;
}

export function WalkthroughNarrativePanel({
  lane,
  pullRequest,
  stagePresentation
}: WalkthroughNarrativePanelProps) {
  const narrative = buildLaneNarrativePresentation(pullRequest, lane);

  return (
    <Paper
      sx={(theme) => ({
        background: `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.94)})`,
        p: 2.25
      })}
      variant="outlined"
    >
      <Stack spacing={2}>
        <Stack spacing={0.75}>
          <Typography variant="subtitle2">Current step</Typography>
          <Typography variant="body2">{stagePresentation.intro}</Typography>
          <Typography color="text.secondary" variant="body2">{lane.summary}</Typography>
          <Typography color="text.secondary" variant="body2">Reviewer goal: {lane.reviewerGoal}</Typography>
        </Stack>
        <ReviewChecklist items={stagePresentation.checklist} />
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
            <Stack spacing={0.25}>
              <Typography variant="subtitle2">Need more guidance?</Typography>
              <Typography color="text.secondary" variant="body2">
                Open this only if you want more context, questions, or signals for this step.
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              <NarrativeBlock items={narrative.highlights} title="What to notice" />
              <NarrativeBlock items={narrative.questions} title="What to confirm" />
              <NarrativeBlock items={narrative.evidence} title="Signals" />
            </Stack>
          </AccordionDetails>
        </Accordion>
        {stagePresentation.finalDecisionOptions.length > 0 ? <DecisionOptions options={stagePresentation.finalDecisionOptions} /> : null}
      </Stack>
    </Paper>
  );
}

function ReviewChecklist({ items }: { readonly items: string[] }) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.default, 0.76),
        p: 1.75
      })}
      variant="outlined"
    >
      <Stack spacing={0.9}>
        <Typography variant="subtitle2">Checklist</Typography>
        {items.map((item) => (
          <Typography key={item} variant="body2">
            {item}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
}

function DecisionOptions({
  options
}: {
  readonly options: readonly ReviewStagePresentation["finalDecisionOptions"][number][];
}) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.secondary.main, 0.07),
        p: 1.75
      })}
      variant="outlined"
    >
      <Stack spacing={1}>
        <Typography variant="subtitle2">Decision Options</Typography>
        {options.map((option) => (
          <Stack key={option.title} spacing={0.35}>
            <Typography variant="body2">{option.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {option.description}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function NarrativeBlock({ items, title }: { readonly items: string[]; readonly title: string }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>
      {items.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          No additional signal has been attached for this area yet.
        </Typography>
      ) : (
        items.map((item) => (
          <Typography key={`${title}-${item}`} variant="body2">
            {item}
          </Typography>
        ))
      )}
    </Stack>
  );
}
