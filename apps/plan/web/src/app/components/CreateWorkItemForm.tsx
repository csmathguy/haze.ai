import { useState } from "react";
import {
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { CreateWorkItemDraftInput, PlanRunMode, WorkItemKind, WorkItemPriority } from "@taxes/shared";

const DEFAULT_FORM_STATE = {
  acceptanceCriteriaText: "",
  auditWorkflowRunId: "",
  kind: "feature" as WorkItemKind,
  planMode: "parallel-agents" as PlanRunMode,
  planStepsText: "",
  planSummary: "",
  priority: "high" as WorkItemPriority,
  summary: "",
  targetIteration: "",
  tasksText: "",
  title: ""
};

interface CreateWorkItemFormProps {
  readonly disabled: boolean;
  readonly onSubmit: (input: CreateWorkItemDraftInput) => Promise<void>;
}

export function CreateWorkItemForm({ disabled, onSubmit }: CreateWorkItemFormProps) {
  const [formState, setFormState] = useState(DEFAULT_FORM_STATE);
  const handleFieldChange = <Key extends keyof typeof DEFAULT_FORM_STATE>(field: Key, value: (typeof DEFAULT_FORM_STATE)[Key]) => {
    setFormState((current) => ({
      ...current,
      [field]: value
    }));
  };

  async function handleSubmit(): Promise<void> {
    const tasks = parseMultilineInput(formState.tasksText);
    const acceptanceCriteria = parseMultilineInput(formState.acceptanceCriteriaText);
    const planSteps = parseMultilineInput(formState.planStepsText);

    await onSubmit({
      acceptanceCriteria,
      auditWorkflowRunId: emptyToUndefined(formState.auditWorkflowRunId),
      kind: formState.kind,
      plan:
        formState.planSummary.trim().length === 0 || planSteps.length === 0
          ? undefined
          : {
              mode: formState.planMode,
              steps: planSteps,
              summary: formState.planSummary.trim()
            },
      priority: formState.priority,
      summary: formState.summary.trim(),
      targetIteration: emptyToUndefined(formState.targetIteration),
      tasks,
      title: formState.title.trim()
    });
    setFormState(DEFAULT_FORM_STATE);
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h2">Create a planning work item</Typography>
        <BasicFieldsSection formState={formState} onFieldChange={handleFieldChange} />
        <MetadataFieldsSection formState={formState} onFieldChange={handleFieldChange} />
        <TaskFieldsSection formState={formState} onFieldChange={handleFieldChange} />
        <PlanFieldsSection formState={formState} onFieldChange={handleFieldChange} />
        <Button
          disabled={disabled || formState.title.trim().length === 0 || formState.summary.trim().length === 0}
          onClick={() => {
            void handleSubmit();
          }}
          variant="contained"
        >
          Save work item
        </Button>
      </Stack>
    </Paper>
  );
}

interface FieldSectionProps {
  readonly formState: typeof DEFAULT_FORM_STATE;
  readonly onFieldChange: <Key extends keyof typeof DEFAULT_FORM_STATE>(field: Key, value: (typeof DEFAULT_FORM_STATE)[Key]) => void;
}

function BasicFieldsSection({ formState, onFieldChange }: FieldSectionProps) {
  return (
    <>
      <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
        <TextField
          fullWidth
          label="Title"
          onChange={(event) => {
            onFieldChange("title", event.target.value);
          }}
          value={formState.title}
        />
        <TextField
          label="Iteration"
          onChange={(event) => {
            onFieldChange("targetIteration", event.target.value);
          }}
          value={formState.targetIteration}
        />
      </Stack>
      <TextField
        fullWidth
        label="Summary"
        minRows={3}
        multiline
        onChange={(event) => {
          onFieldChange("summary", event.target.value);
        }}
        value={formState.summary}
      />
    </>
  );
}

function MetadataFieldsSection({ formState, onFieldChange }: FieldSectionProps) {
  return (
    <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
      <SelectField
        label="Kind"
        onChange={(value) => {
          onFieldChange("kind", value as WorkItemKind);
        }}
        options={["epic", "feature", "maintenance", "spike", "task"]}
        value={formState.kind}
      />
      <SelectField
        label="Priority"
        onChange={(value) => {
          onFieldChange("priority", value as WorkItemPriority);
        }}
        options={["critical", "high", "medium", "low"]}
        value={formState.priority}
      />
      <TextField
        fullWidth
        label="Audit workflow run ID"
        onChange={(event) => {
          onFieldChange("auditWorkflowRunId", event.target.value);
        }}
        value={formState.auditWorkflowRunId}
      />
    </Stack>
  );
}

function TaskFieldsSection({ formState, onFieldChange }: FieldSectionProps) {
  return (
    <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
      <TextField
        fullWidth
        helperText="One task per line."
        label="Tasks"
        minRows={5}
        multiline
        onChange={(event) => {
          onFieldChange("tasksText", event.target.value);
        }}
        value={formState.tasksText}
      />
      <TextField
        fullWidth
        helperText="One acceptance criterion per line."
        label="Acceptance criteria"
        minRows={5}
        multiline
        onChange={(event) => {
          onFieldChange("acceptanceCriteriaText", event.target.value);
        }}
        value={formState.acceptanceCriteriaText}
      />
    </Stack>
  );
}

function PlanFieldsSection({ formState, onFieldChange }: FieldSectionProps) {
  return (
    <>
      <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
        <TextField
          fullWidth
          label="Plan summary"
          minRows={3}
          multiline
          onChange={(event) => {
            onFieldChange("planSummary", event.target.value);
          }}
          value={formState.planSummary}
        />
        <SelectField
          label="Plan mode"
          onChange={(value) => {
            onFieldChange("planMode", value as PlanRunMode);
          }}
          options={["manual", "single-agent", "parallel-agents"]}
          value={formState.planMode}
        />
      </Stack>
      <TextField
        fullWidth
        helperText="One plan step per line."
        label="Plan steps"
        minRows={4}
        multiline
        onChange={(event) => {
          onFieldChange("planStepsText", event.target.value);
        }}
        value={formState.planStepsText}
      />
    </>
  );
}

interface SelectFieldProps {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly value: string;
}

function SelectField({ label, onChange, options, value }: SelectFieldProps) {
  return (
    <TextField
      fullWidth
      label={label}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      select
      value={value}
    >
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
    </TextField>
  );
}

function emptyToUndefined(value: string): string | undefined {
  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

function parseMultilineInput(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
