import { useState } from "react";
import {
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { CreateWorkItemDraftInput, PlanningProject, PlanRunMode, WorkItemKind, WorkItemPriority } from "@taxes/shared";

const DEFAULT_FORM_STATE = {
  acceptanceCriteriaText: "",
  auditWorkflowRunId: "",
  kind: "feature" as WorkItemKind,
  planMode: "parallel-agents" as PlanRunMode,
  planStepsText: "",
  planSummary: "",
  priority: "high" as WorkItemPriority,
  projectKey: "planning",
  summary: "",
  targetIteration: "",
  tasksText: "",
  title: ""
};

interface CreateWorkItemFormProps {
  readonly disabled: boolean;
  readonly onSubmit: (input: CreateWorkItemDraftInput) => Promise<boolean>;
  readonly projects: PlanningProject[];
  readonly showTitle?: boolean;
  readonly submitLabel?: string;
  readonly surface?: "paper" | "plain";
}

export function CreateWorkItemForm({
  disabled,
  onSubmit,
  projects,
  showTitle = true,
  submitLabel = "Save work item",
  surface = "paper"
}: CreateWorkItemFormProps) {
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

    const wasSaved = await onSubmit({
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
      projectKey: formState.projectKey,
      summary: formState.summary.trim(),
      targetIteration: emptyToUndefined(formState.targetIteration),
      tasks,
      title: formState.title.trim()
    });

    if (wasSaved) {
      setFormState(DEFAULT_FORM_STATE);
    }
  }

  const content = (
    <Stack spacing={2.5}>
      {showTitle ? <Typography variant="h2">Create a planning work item</Typography> : null}
      <BasicFieldsSection formState={formState} onFieldChange={handleFieldChange} />
      <MetadataFieldsSection formState={formState} onFieldChange={handleFieldChange} projects={projects} />
      <TaskFieldsSection formState={formState} onFieldChange={handleFieldChange} />
      <PlanFieldsSection formState={formState} onFieldChange={handleFieldChange} />
      <Button
        disabled={disabled || formState.title.trim().length === 0 || formState.summary.trim().length === 0}
        onClick={() => {
          void handleSubmit();
        }}
        variant="contained"
      >
        {submitLabel}
      </Button>
    </Stack>
  );

  if (surface === "plain") {
    return content;
  }

  return <Paper sx={{ p: 3 }}>{content}</Paper>;
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

function MetadataFieldsSection({
  formState,
  onFieldChange,
  projects
}: FieldSectionProps & { readonly projects: PlanningProject[] }) {
  return (
    <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
      <SelectField
        label="Project"
        onChange={(value) => {
          onFieldChange("projectKey", value);
        }}
        options={projects.map((project) => ({
          label: project.name,
          value: project.key
        }))}
        value={formState.projectKey}
      />
      <SelectField
        label="Kind"
        onChange={(value) => {
          onFieldChange("kind", value as WorkItemKind);
        }}
        options={["epic", "feature", "maintenance", "spike", "task"].map((option) => ({
          label: option,
          value: option
        }))}
        value={formState.kind}
      />
      <SelectField
        label="Priority"
        onChange={(value) => {
          onFieldChange("priority", value as WorkItemPriority);
        }}
        options={["critical", "high", "medium", "low"].map((option) => ({
          label: option,
          value: option
        }))}
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
          options={["manual", "single-agent", "parallel-agents"].map((option) => ({
            label: option,
            value: option
          }))}
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
  readonly options: readonly {
    label: string;
    value: string;
  }[];
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
        <MenuItem key={option.value} value={option.value}>
          {option.label}
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
