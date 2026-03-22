import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import type { ReactNode } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { ReviewNotebookEntry } from "../walkthrough.js";

interface ReviewNotebookPanelProps {
  readonly entry: ReviewNotebookEntry;
  readonly isFinalStage?: boolean;
  readonly laneTitle: string;
  readonly onChange: (patch: Partial<ReviewNotebookEntry>) => void;
}

export function ReviewNotebookPanel({ entry, isFinalStage = false, laneTitle, onChange }: ReviewNotebookPanelProps) {
  return (
    <Paper sx={{ p: 2.5 }} variant="outlined">
      <Stack spacing={2.25}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Review Companion</Typography>
          <Typography variant="h3">What to do in this step</Typography>
          <Typography color="text.secondary" variant="body2">
            Mark your progress, write one short note to carry forward, and only open the extra fields if this step still feels unclear.
          </Typography>
        </Stack>

        <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
          <StatusButton
            icon={<EditNoteOutlinedIcon />}
            isActive={entry.status === "in-progress"}
            label="Still reviewing"
            onClick={() => {
              onChange({ status: "in-progress" });
            }}
          />
          <StatusButton
            icon={<CheckCircleOutlineOutlinedIcon />}
            isActive={entry.status === "confirmed"}
            label="Confirmed"
            onClick={() => {
              onChange({ status: "confirmed" });
            }}
          />
          <StatusButton
            icon={<ErrorOutlineOutlinedIcon />}
            isActive={entry.status === "needs-follow-up"}
            label="Needs follow-up"
            onClick={() => {
              onChange({ status: "needs-follow-up" });
            }}
          />
        </Stack>

        <NotebookFields entry={entry} isFinalStage={isFinalStage} laneTitle={laneTitle} onChange={onChange} />
      </Stack>
    </Paper>
  );
}

function NotebookFields({
  entry,
  isFinalStage,
  laneTitle,
  onChange
}: {
  readonly entry: ReviewNotebookEntry;
  readonly isFinalStage: boolean;
  readonly laneTitle: string;
  readonly onChange: (patch: Partial<ReviewNotebookEntry>) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <TextField
        helperText={`Leave a short note about ${laneTitle.toLowerCase()} so the reviewer knows what to remember before moving on.`}
        label="Carry-forward note"
        multiline
        minRows={3}
        onChange={(event) => {
          onChange({ notes: event.target.value });
        }}
        value={entry.notes}
      />
      <Accordion disableGutters elevation={0} sx={{ "&::before": { display: "none" }, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
        <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
          <Stack spacing={0.25}>
            <Typography variant="subtitle2">Need more detail?</Typography>
            <Typography color="text.secondary" variant="body2">
              Open this only if you want to capture separate concerns or confidence notes.
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <TextField
              label="Questions or concerns"
              multiline
              minRows={3}
              onChange={(event) => {
                onChange({ concerns: event.target.value });
              }}
              value={entry.concerns}
            />
            <TextField
              label="Confidence notes"
              multiline
              minRows={3}
              onChange={(event) => {
                onChange({ confirmations: event.target.value });
              }}
              value={entry.confirmations}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
      {isFinalStage ? <FollowUpField followUps={entry.followUps} onChange={onChange} /> : null}
    </Stack>
  );
}

function FollowUpField({
  followUps,
  onChange
}: {
  readonly followUps: string;
  readonly onChange: (patch: Partial<ReviewNotebookEntry>) => void;
}) {
  return (
    <TextField
      helperText="One follow-up per line works well for future work items or refactor ideas."
      label="Follow-up candidates"
      multiline
      minRows={4}
      onChange={(event) => {
        onChange({ followUps: event.target.value });
      }}
      value={followUps}
    />
  );
}

function StatusButton({
  icon,
  isActive,
  label,
  onClick
}: {
  readonly icon: ReactNode;
  readonly isActive: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      startIcon={icon}
      sx={(theme) => ({
        backgroundColor: isActive ? alpha(theme.palette.secondary.main, 0.1) : undefined,
        borderColor: isActive ? alpha(theme.palette.secondary.main, 0.4) : undefined,
        justifyContent: "flex-start"
      })}
      variant={isActive ? "contained" : "outlined"}
    >
      {label}
    </Button>
  );
}
