import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CodeRounded from "@mui/icons-material/CodeRounded";
import EditNoteRounded from "@mui/icons-material/EditNoteRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import FlagRounded from "@mui/icons-material/FlagRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import HubRounded from "@mui/icons-material/HubRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import ManageSearchRounded from "@mui/icons-material/ManageSearchRounded";
import RuleRounded from "@mui/icons-material/RuleRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import ViewKanbanRounded from "@mui/icons-material/ViewKanbanRounded";
import WindowRounded from "@mui/icons-material/WindowRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { alpha, keyframes, useColorScheme } from "@mui/material/styles";
import { type ReactNode, useEffect, useMemo, useReducer, useState } from "react";
import {
  fetchRecentAudit,
  fetchWorkflowStatusModel,
  patchTask,
  fetchStatus,
  fetchTasks,
  postJson,
  subscribeAudit,
  type AuditEventRecord,
  type OrchestratorStatus,
  type TaskRecord,
  type TaskStatus,
  type WorkflowStatusModelEntry
} from "./api";
import { getKanbanUiTokens } from "./kanban-ui-tokens";
import { ModeToggle } from "./components/ModeToggle";

type ViewName = "dashboard" | "kanban";

const resolveViewFromLocation = (): ViewName => {
  if (typeof window === "undefined") {
    return "dashboard";
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "kanban" ? "kanban" : "dashboard";
};

const syncViewToLocation = (view: ViewName): void => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get("view") === view) {
    return;
  }

  url.searchParams.set("view", view);
  window.history.pushState({ view }, "", `${url.pathname}${url.search}${url.hash}`);
};

interface DashboardState {
  status: OrchestratorStatus | null;
  loading: boolean;
  error: string | null;
  audit: AuditEventRecord[];
}

type DashboardAction =
  | { type: "request-start" }
  | { type: "request-success"; status: OrchestratorStatus }
  | { type: "request-error"; message: string }
  | { type: "audit-seed"; records: AuditEventRecord[] }
  | { type: "audit-add"; record: AuditEventRecord };

const initialDashboardState: DashboardState = {
  status: null,
  loading: false,
  error: null,
  audit: []
};

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction
): DashboardState {
  switch (action.type) {
    case "request-start":
      return { ...state, loading: true, error: null };
    case "request-success":
      return { ...state, status: action.status, loading: false, error: null };
    case "request-error":
      return { ...state, loading: false, error: action.message };
    case "audit-seed":
      return { ...state, audit: action.records };
    case "audit-add":
      return { ...state, audit: [action.record, ...state.audit].slice(0, 100) };
    default:
      return state;
  }
}

const pulseAnimation = keyframes`
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(0, -5px, 0) scale(1.01); }
  100% { transform: translate3d(0, 0, 0) scale(1); }
`;

function DashboardView() {
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState);

  const refresh = async () => {
    dispatch({ type: "request-start" });
    try {
      const next = await fetchStatus();
      dispatch({ type: "request-success", status: next });
    } catch (error) {
      dispatch({ type: "request-error", message: (error as Error).message });
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadAudit = async () => {
      try {
        const records = await fetchRecentAudit(50);
        if (mounted) {
          dispatch({ type: "audit-seed", records });
        }
      } catch (error) {
        if (mounted) {
          dispatch({ type: "request-error", message: (error as Error).message });
        }
      }
    };

    void loadAudit();
    const unsubscribe = subscribeAudit((record) => {
      dispatch({ type: "audit-add", record });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const wake = async () => {
    await postJson("/api/orchestrator/wake", { reason: "frontend_manual_wake" });
    await refresh();
  };

  const pulse = async () => {
    await postJson("/api/heartbeat/pulse", { source: "frontend_manual_pulse" });
    await refresh();
  };

  return (
    <Stack spacing={3}>
      {state.error && <Alert severity="error">{state.error}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Card
          sx={{
            flex: 1,
            border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
            backgroundImage: (theme) =>
              `linear-gradient(125deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.12)})`,
            animation: `${pulseAnimation} 7s ease-in-out infinite`,
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none"
            }
          }}
        >
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FavoriteRounded color="secondary" />
                <Typography variant="h6">Orchestrator Status</Typography>
              </Stack>
              {state.status ? (
                <>
                  <Chip
                    label={state.status.busy ? "Running" : "Idle"}
                    color={state.status.busy ? "secondary" : "primary"}
                    sx={{ width: "fit-content" }}
                  />
                  <Typography>
                    <strong>Last wake reason:</strong> {state.status.lastWakeReason}
                  </Typography>
                </>
              ) : (
                <Typography color="text.secondary">No status loaded yet.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ width: { xs: "100%", md: 340 } }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <BoltRounded color="primary" />
                <Typography variant="h6">Control Actions</Typography>
              </Stack>
              <Button variant="contained" onClick={() => void wake()} disabled={state.loading}>
                Wake Orchestrator
              </Button>
              <Button variant="outlined" onClick={() => void pulse()} disabled={state.loading}>
                Send Heartbeat Pulse
              </Button>
              <Button
                variant="text"
                startIcon={<AutorenewRounded />}
                onClick={() => void refresh()}
                disabled={state.loading}
              >
                Refresh
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <HistoryRounded color="primary" />
              <Typography variant="h6">Live Audit Feed</Typography>
              <Chip label="Live" color="secondary" size="small" />
            </Stack>
            <Stack
              spacing={1}
              sx={{
                maxHeight: 320,
                overflowY: "auto",
                pr: 1
              }}
            >
              {state.audit.length === 0 && (
                <Typography color="text.secondary">No audit events yet.</Typography>
              )}
              {state.audit.map((event) => (
                <Box key={event.id}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(event.timestamp).toLocaleString()} | {event.actor}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {event.eventType}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    request: {event.requestId.slice(0, 8)}... trace: {event.traceId.slice(0, 8)}
                    ...
                  </Typography>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

const columns: Array<{ status: TaskRecord["status"]; label: string }> = [
  { status: "backlog", label: "Backlog" },
  { status: "planning", label: "Planning" },
  { status: "implementing", label: "Implementing" },
  { status: "review", label: "Review" },
  { status: "verification", label: "Verification" },
  { status: "awaiting_human", label: "Awaiting Human" },
  { status: "done", label: "Done" },
  { status: "cancelled", label: "Cancelled" }
];

function MetaPill({
  icon,
  label,
  tone = "neutral",
  colors,
  textColor,
  tooltip,
  ariaLabel,
  onClick,
  testId
}: {
  icon: ReactNode;
  label: string;
  tone?: "neutral" | "accent";
  colors: {
    bg: string;
    border: string;
    text: string;
    icon: string;
    accentBg: string;
    accentBorder: string;
    accentText: string;
  };
  textColor: string;
  tooltip?: string;
  ariaLabel?: string;
  onClick?: () => void;
  testId?: string;
}) {
  const content = (
    <Box
      component={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        borderRadius: 999,
        px: 1,
        py: 0.25,
        border: `1px solid ${tone === "accent" ? colors.accentBorder : colors.border}`,
        backgroundColor: tone === "accent" ? colors.accentBg : colors.bg,
        appearance: "none",
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        font: "inherit",
        ...(onClick
          ? {
              "&:focus-visible": {
                outline: `2px solid ${colors.accentBorder}`,
                outlineOffset: 2
              }
            }
          : {})
      }}
    >
      <Box
        sx={{
          display: "inline-flex",
          color: tone === "accent" ? colors.accentText : colors.icon,
          "& svg": { fontSize: 13 }
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: tone === "accent" ? colors.accentText : textColor
        }}
      >
        {label}
      </Typography>
    </Box>
  );

  if (!tooltip) {
    return content;
  }

  return <Tooltip title={tooltip}>{content}</Tooltip>;
}

type DetailAnswer = {
  actor: string;
  message: string;
  timestamp: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isTaskBlockedByDependencies(
  task: Pick<TaskRecord, "dependencies">,
  tasksById: ReadonlyMap<string, TaskRecord>
): boolean {
  if (task.dependencies.length === 0) {
    return false;
  }

  return task.dependencies.some((dependencyId) => tasksById.get(dependencyId)?.status !== "done");
}

function normalizeAnswerThread(value: unknown): DetailAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          actor: "human",
          message: entry,
          timestamp: null
        };
      }

      const item = asRecord(entry);
      if (!item) {
        return null;
      }

      const actor = typeof item.actor === "string" ? item.actor : "human";
      const messageCandidate = ["message", "answer", "response", "text"]
        .map((key) => item[key])
        .find((candidate) => typeof candidate === "string");
      if (typeof messageCandidate !== "string") {
        return null;
      }

      return {
        actor,
        message: messageCandidate,
        timestamp: typeof item.timestamp === "string" ? item.timestamp : null
      };
    })
    .filter((entry): entry is DetailAnswer => entry !== null);
}

function getTaskDisplayId(task: TaskRecord): string {
  const canonicalId = asRecord(task.metadata)?.canonicalTaskId;
  if (typeof canonicalId === "string" && canonicalId.trim().length > 0) {
    return canonicalId;
  }
  return task.id;
}

function formatShortTimestamp(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatVerboseTimestamp(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString();
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function DetailSection({
  title,
  icon,
  children,
  defaultExpanded = false
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion disableGutters variant="outlined" defaultExpanded={defaultExpanded}>
      <AccordionSummary
        expandIcon={<ExpandMoreRounded />}
        aria-label={title}
        sx={{
          px: 1.5,
          "& .MuiAccordionSummary-content": { my: 1 }
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ display: "inline-flex", "& svg": { fontSize: 18 } }}>{icon}</Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 1.5, pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

function KanbanView() {
  const { mode } = useColorScheme();
  const tokens = getKanbanUiTokens(mode === "dark" ? "dark" : "light");
  const isDarkMode = mode === "dark";
  const cardTitleColor = isDarkMode ? "#edf3ff" : "#142034";
  const cardBodyColor = isDarkMode ? "#c4d2e8" : "#44516a";
  const cardMetaColor = isDarkMode ? "#eaf2ff" : "#1d2a3f";
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskDetailStack, setTaskDetailStack] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>("backlog");
  const [statusNote, setStatusNote] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [statusModel, setStatusModel] = useState<WorkflowStatusModelEntry[]>([]);
  const [statusDetailsOpen, setStatusDetailsOpen] = useState(false);
  const [statusDetailsStatus, setStatusDetailsStatus] = useState<TaskStatus>("backlog");
  const [statusDetailsTaskId, setStatusDetailsTaskId] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchTasks();
      setTasks(next);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadStatusModel = async () => {
      try {
        const model = await fetchWorkflowStatusModel();
        if (mounted) {
          setStatusModel(model.statuses);
        }
      } catch (loadError) {
        if (mounted) {
          setError((loadError as Error).message);
        }
      }
    };

    const loadAudit = async () => {
      try {
        const records = await fetchRecentAudit(200);
        if (mounted) {
          setAuditEvents(records);
        }
      } catch (loadError) {
        if (mounted) {
          setError((loadError as Error).message);
        }
      }
    };

    void loadStatusModel();
    void loadAudit();
    const unsubscribe = subscribeAudit((record) => {
      setAuditEvents((previous) => [record, ...previous].slice(0, 200));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const selectedTaskId = taskDetailStack.length > 0 ? taskDetailStack[taskDetailStack.length - 1] : null;

  const openTaskDetails = (taskId: string): void => {
    setTaskDetailStack((previous) => {
      if (previous[previous.length - 1] === taskId) {
        return previous;
      }
      return [...previous, taskId];
    });
  };

  const closeTaskDetails = (): void => {
    setTaskDetailStack([]);
  };

  const openStatusDetails = (status: TaskStatus, taskId: string | null = null): void => {
    setStatusDetailsStatus(status);
    setStatusDetailsTaskId(taskId);
    setStatusDetailsOpen(true);
  };

  const closeStatusDetails = (): void => {
    setStatusDetailsOpen(false);
  };

  const navigateBackInTaskDetails = (): void => {
    setTaskDetailStack((previous) =>
      previous.length > 1 ? previous.slice(0, previous.length - 1) : previous
    );
  };

  const tasksByStatus = useMemo(() => {
    const grouped = new Map<TaskRecord["status"], TaskRecord[]>();
    for (const column of columns) {
      grouped.set(column.status, []);
    }

    for (const task of tasks) {
      const lane = grouped.get(task.status) ?? [];
      lane.push(task);
      grouped.set(task.status, lane);
    }

    for (const [status, lane] of grouped.entries()) {
      grouped.set(
        status,
        lane.sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))
      );
    }

    return grouped;
  }, [tasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );
  const statusDetailsModel = useMemo(
    () => statusModel.find((entry) => entry.status === statusDetailsStatus) ?? null,
    [statusModel, statusDetailsStatus]
  );
  const statusDetailsTask = useMemo(
    () => (statusDetailsTaskId ? tasksById.get(statusDetailsTaskId) ?? null : null),
    [statusDetailsTaskId, tasksById]
  );
  const statusDetailsRuntime = asRecord(statusDetailsTask?.metadata.workflowRuntime);
  const statusDetailsActionHistory = Array.isArray(statusDetailsRuntime?.actionHistory)
    ? statusDetailsRuntime.actionHistory.map((entry) => asRecord(entry)).filter((entry) => entry !== null)
    : [];
  const statusDetailsOnEnterActionCount = statusDetailsActionHistory.filter(
    (entry) => entry.status === statusDetailsStatus && entry.phase === "onEnter"
  ).length;
  const statusDetailsOnExitActionCount = statusDetailsActionHistory.filter(
    (entry) => entry.status === statusDetailsStatus && entry.phase === "onExit"
  ).length;
  const statusDetailsAuditEvents = statusDetailsTask
    ? auditEvents.filter((event) => {
        const payload = asRecord(event.payload);
        return payload?.taskId === statusDetailsTask.id;
      })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : [];

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }

    const validTaskIds = new Set(tasks.map((task) => task.id));
    if (!validTaskIds.has(selectedTaskId)) {
      setTaskDetailStack((previous) => previous.filter((taskId) => validTaskIds.has(taskId)));
    }
  }, [selectedTaskId, tasks]);

  const selectedTaskStatusLabel = selectedTask
    ? columns.find((column) => column.status === selectedTask.status)?.label ?? selectedTask.status
    : "";

  const selectedPlanningArtifact = asRecord(selectedTask?.metadata.planningArtifact);
  const selectedAwaitingHumanArtifact = asRecord(selectedTask?.metadata.awaitingHumanArtifact);
  const selectedWorkflow = asRecord(selectedTask?.metadata.workflow);
  const selectedAnswerThread = normalizeAnswerThread(
    selectedTask?.metadata.answerThread ??
      selectedAwaitingHumanArtifact?.answerThread ??
      selectedAwaitingHumanArtifact?.answers
  );
  const planningGoals = asStringArray(selectedPlanningArtifact?.goals);
  const planningSteps = asStringArray(
    selectedPlanningArtifact?.implementationSteps ?? selectedPlanningArtifact?.steps
  );
  const selectedAcceptanceCriteria = asStringArray(selectedTask?.metadata.acceptanceCriteria);
  const questionnaireOptions = asStringArray(selectedAwaitingHumanArtifact?.options);
  const selectedTaskDisplayId = selectedTask ? getTaskDisplayId(selectedTask) : "";
  const selectedWorkflowBranch =
    selectedWorkflow && typeof selectedWorkflow.branchName === "string"
      ? selectedWorkflow.branchName
      : null;
  const selectedWorkflowPullRequest = asRecord(selectedWorkflow?.pullRequest);
  const selectedGithubMetadata = asRecord(selectedTask?.metadata.github);
  const selectedPullRequestUrl =
    asString(selectedWorkflow?.pullRequestUrl) ??
    asString(selectedWorkflow?.prUrl) ??
    asString(selectedWorkflowPullRequest?.url) ??
    asString(selectedWorkflowPullRequest?.link) ??
    asString(selectedGithubMetadata?.pullRequestUrl) ??
    asString(selectedGithubMetadata?.prUrl);
  const selectedGithubRepo =
    asString(selectedWorkflow?.repository) ??
    asString(selectedWorkflow?.repo) ??
    asString(selectedGithubMetadata?.repository) ??
    asString(selectedGithubMetadata?.repo);
  const selectedTaskStatus = selectedTask?.status;
  const selectedTaskDependencies = selectedTask?.dependencies ?? [];
  const selectedTaskDependents = selectedTask?.dependents ?? [];
  const selectedTaskIsBlocked = selectedTask
    ? isTaskBlockedByDependencies(selectedTask, tasksById)
    : false;
  const selectedTaskReferences = uniqueStrings([
    ...asStringArray(selectedTask?.metadata.references),
    ...asStringArray(selectedTask?.metadata.links),
    ...asStringArray(selectedTask?.metadata.researchReferences)
  ]);
  const selectedTestingArtifacts = asRecord(selectedTask?.metadata.testingArtifacts);
  const selectedTestingPlan = asRecord(selectedTestingArtifacts?.planned);
  const selectedTestingImplemented = asRecord(selectedTestingArtifacts?.implemented);
  const plannedGherkinScenarios = asStringArray(selectedTestingPlan?.gherkinScenarios);
  const plannedUnitTestIntent = asStringArray(selectedTestingPlan?.unitTestIntent);
  const plannedIntegrationTestIntent = asStringArray(selectedTestingPlan?.integrationTestIntent);
  const plannedTestingNotes = asString(selectedTestingPlan?.notes);
  const implementedTests = asStringArray(selectedTestingImplemented?.testsAddedOrUpdated);
  const implementedEvidenceLinks = asStringArray(selectedTestingImplemented?.evidenceLinks);
  const implementedCommandsRun = asStringArray(selectedTestingImplemented?.commandsRun);
  const implementedTestingNotes = asString(selectedTestingImplemented?.notes);
  const plannedTestingItemCount =
    plannedGherkinScenarios.length + plannedUnitTestIntent.length + plannedIntegrationTestIntent.length;
  const implementedTestingItemCount =
    implementedTests.length + implementedEvidenceLinks.length + implementedCommandsRun.length;
  const selectedRetrospectives = Array.isArray(selectedTask?.metadata.retrospectives)
    ? selectedTask.metadata.retrospectives
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
    : [];
  const timelineRows = selectedTask
    ? [
        {
          label: "Created",
          shortValue: formatShortTimestamp(selectedTask.createdAt),
          fullValue: formatVerboseTimestamp(selectedTask.createdAt)
        },
        {
          label: "Updated",
          shortValue: formatShortTimestamp(selectedTask.updatedAt),
          fullValue: formatVerboseTimestamp(selectedTask.updatedAt)
        },
        {
          label: "Started",
          shortValue: formatShortTimestamp(selectedTask.startedAt),
          fullValue: formatVerboseTimestamp(selectedTask.startedAt)
        },
        {
          label: "Due",
          shortValue: formatShortTimestamp(selectedTask.dueAt),
          fullValue: formatVerboseTimestamp(selectedTask.dueAt)
        },
        {
          label: "Completed",
          shortValue: formatShortTimestamp(selectedTask.completedAt),
          fullValue: formatVerboseTimestamp(selectedTask.completedAt)
        }
      ]
    : [];

  useEffect(() => {
    if (!selectedTaskId || !selectedTaskStatus) {
      return;
    }
    setSelectedStatus(selectedTaskStatus);
    setStatusNote("");
    setStatusUpdateError(null);
  }, [selectedTaskId, selectedTaskStatus]);

  const handleStatusUpdate = async () => {
    if (!selectedTask || statusUpdating || selectedStatus === selectedTask.status) {
      return;
    }

    setStatusUpdating(true);
    setStatusUpdateError(null);
    try {
      const metadata = {
        ...selectedTask.metadata,
        transitionNote:
          statusNote.trim().length > 0
            ? statusNote.trim()
            : `Human updated status from ${selectedTask.status} to ${selectedStatus} via task detail UI.`
      };

      await patchTask(selectedTask.id, {
        status: selectedStatus,
        metadata
      });
      await refresh();
    } catch (updateError) {
      setStatusUpdateError((updateError as Error).message);
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography color="text.secondary">
          Real-time workflow board for orchestrator and agent task execution.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AutorenewRounded />}
          onClick={() => void refresh()}
          disabled={loading}
        >
          Refresh Board
        </Button>
      </Stack>

      <Box
        sx={{
          overflowX: "auto",
          pb: 1
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: {
              xs: "minmax(260px, 84vw)",
              sm: "minmax(280px, 68vw)",
              md: "minmax(300px, 340px)"
            },
            gap: 2,
            minWidth: "max-content",
            alignItems: "start"
          }}
        >
          {columns.map((column) => (
            <Card
              key={column.status}
              sx={{
                minWidth: 0,
                minHeight: { xs: 420, md: 500 },
                border: `1px solid ${tokens.lane.border}`,
                backgroundColor: tokens.lane.bg,
                display: "flex",
                flexDirection: "column"
              }}
            >
            <CardContent sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
              <Stack spacing={1.5} sx={{ minHeight: 0, flexGrow: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    backgroundColor: tokens.lane.headerBg,
                    py: 0.5
                  }}
                >
                  <Typography
                    component="button"
                    type="button"
                    variant="subtitle1"
                    aria-label={`Open status details for ${column.label}`}
                    onClick={() => openStatusDetails(column.status)}
                    sx={{
                      fontWeight: 700,
                      color: tokens.lane.title,
                      appearance: "none",
                      border: 0,
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      "&:focus-visible": {
                        outline: `2px solid ${tokens.meta.accentBorder}`,
                        outlineOffset: 2,
                        borderRadius: 1
                      }
                    }}
                  >
                    {column.label}
                  </Typography>
                  <Chip
                    size="small"
                    label={tasksByStatus.get(column.status)?.length ?? 0}
                    sx={{
                      backgroundColor: tokens.lane.countBg,
                      color: tokens.lane.countText,
                      fontWeight: 700
                    }}
                  />
                </Stack>
                <Divider />
                <Stack
                  data-testid={`lane-scroll-${column.status}`}
                  data-lane-scroll="true"
                  spacing={1.25}
                  style={{ height: "520px", minHeight: "360px", overflowY: "scroll" }}
                  sx={{ pr: 0.5 }}
                >
                  {(tasksByStatus.get(column.status) ?? []).map((task) => (
                    <Card
                      key={task.id}
                      variant="outlined"
                      data-card-fixed="true"
                      sx={{
                        borderColor: tokens.card.border,
                        borderWidth: 1.25,
                        backgroundColor: tokens.card.bg,
                        backgroundImage:
                          mode === "dark"
                            ? "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))"
                            : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(242,248,255,0.95))",
                        boxShadow: tokens.card.shadow,
                        height: 196,
                        minHeight: 196,
                        maxHeight: 196,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 2
                      }}
                    >
                      <CardContent
                        sx={{
                          "&:last-child": { pb: 1.5 },
                          display: "flex",
                          flexDirection: "column",
                          height: "100%"
                        }}
                      >
                        <Stack spacing={1} sx={{ minHeight: 0, justifyContent: "space-between", flexGrow: 1 }}>
                          <Typography
                            fontWeight={700}
                            component="button"
                            type="button"
                            onClick={() => openTaskDetails(task.id)}
                            sx={{
                              appearance: "none",
                              background: "transparent",
                              border: 0,
                              padding: 0,
                              margin: 0,
                              width: "100%",
                              textAlign: "left",
                              display: "-webkit-box",
                              cursor: "pointer",
                              fontSize: "0.98rem",
                              lineHeight: 1.3,
                              wordBreak: "break-word",
                              color: `${cardTitleColor} !important`,
                              fontWeight: 700,
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 2,
                              overflow: "hidden",
                              "&:focus-visible": {
                                outline: `2px solid ${tokens.meta.accentBorder}`,
                                outlineOffset: 2,
                                borderRadius: 1
                              }
                            }}
                          >
                            {task.title}
                          </Typography>
                          {task.description && (
                            <Typography
                              variant="body2"
                              color={`${cardBodyColor} !important`}
                              sx={{
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                                overflow: "hidden"
                              }}
                            >
                              {task.description}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <MetaPill
                              icon={<HistoryRounded />}
                              label={`ID ${getTaskDisplayId(task)}`}
                              colors={tokens.meta}
                              textColor={cardMetaColor}
                            />
                            <MetaPill
                              icon={<FlagRounded />}
                              label={`P${task.priority}`}
                              tone="accent"
                              colors={tokens.meta}
                              textColor={cardMetaColor}
                            />
                            <MetaPill
                              icon={<HubRounded />}
                              label={`${task.dependencies.length}`}
                              colors={tokens.meta}
                              textColor={cardMetaColor}
                              tooltip="Dependencies"
                              ariaLabel={`Dependencies: ${task.dependencies.length}`}
                            />
                            <MetaPill
                              icon={<AccountTreeRounded />}
                              label={`${(task.dependents ?? []).length}`}
                              colors={tokens.meta}
                              textColor={cardMetaColor}
                              tooltip="Dependents"
                              ariaLabel={`Dependents: ${(task.dependents ?? []).length}`}
                            />
                            {isTaskBlockedByDependencies(task, tasksById) && (
                              <Tooltip title="Blocked by dependencies">
                                <Box
                                  aria-label="Blocked by dependencies"
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: 999,
                                    px: 0.75,
                                    py: 0.25,
                                    border: "1px solid #f48c8c",
                                    backgroundColor: "rgba(191, 47, 47, 0.2)",
                                    color: "#ffb3b3",
                                    "& svg": { fontSize: 13 }
                                  }}
                                >
                                  <BlockRounded />
                                </Box>
                              </Tooltip>
                            )}
                            {task.tags.slice(0, 2).map((tag) => (
                              <MetaPill
                                key={tag}
                                icon={<LocalOfferRounded />}
                                label={tag}
                                colors={tokens.meta}
                                textColor={cardMetaColor}
                              />
                            ))}
                            {task.tags.length > 2 && (
                              <MetaPill
                                icon={<LocalOfferRounded />}
                                label={`+${task.tags.length - 2}`}
                                colors={tokens.meta}
                                textColor={cardMetaColor}
                              />
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                  {(tasksByStatus.get(column.status) ?? []).length === 0 && (
                    <Typography variant="body2" sx={{ color: tokens.lane.empty }}>
                      No tasks in this lane.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={Boolean(selectedTask)}
        onClose={closeTaskDetails}
      >
        <Box sx={{ width: { xs: "100vw", sm: 460 }, p: 2.5 }}>
          {selectedTask && (
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={0.5}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {taskDetailStack.length > 1 && (
                    <IconButton
                      size="small"
                      aria-label="Back to previous task"
                      onClick={navigateBackInTaskDetails}
                    >
                      <ArrowBackRounded />
                    </IconButton>
                  )}
                  <Typography variant="h6">{selectedTask.title}</Typography>
                </Stack>
                <IconButton
                  size="small"
                  aria-label="Close task details"
                  onClick={closeTaskDetails}
                  sx={{ mt: -0.25, mr: -0.25 }}
                >
                  <CloseRounded />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <MetaPill
                  icon={<HistoryRounded />}
                  label={`ID ${selectedTaskDisplayId}`}
                  colors={tokens.meta}
                  textColor={cardMetaColor}
                />
                <MetaPill
                  icon={<FlagRounded />}
                  label={selectedTaskStatusLabel}
                  tone="accent"
                  colors={tokens.meta}
                  textColor={cardMetaColor}
                  tooltip={`Current status: ${selectedTaskStatusLabel}`}
                  ariaLabel={`Open status details for ${selectedTaskStatusLabel} (selected task)`}
                  testId="selected-task-status-pill"
                  onClick={() => selectedTask && openStatusDetails(selectedTask.status, selectedTask.id)}
                />
              </Stack>

              {selectedTask.description && (
                <Typography variant="body2">{selectedTask.description}</Typography>
              )}

              <DetailSection title="Timeline" icon={<ScheduleRounded />} defaultExpanded>
                <TableContainer>
                  <Table size="small" aria-label="Timeline details">
                    <TableBody>
                      {timelineRows.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell sx={{ fontWeight: 700, width: "40%", borderBottom: 0, px: 0 }}>
                            {row.label}
                          </TableCell>
                          <TableCell sx={{ borderBottom: 0, px: 0 }}>
                            <Tooltip title={row.fullValue}>
                              <Box component="span">{row.shortValue}</Box>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DetailSection>

              <DetailSection title="GitHub" icon={<CodeRounded />} defaultExpanded>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Branch:</strong> {selectedWorkflowBranch ?? "N/A"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Repository:</strong> {selectedGithubRepo ?? "N/A"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Pull Request:</strong>{" "}
                    {selectedPullRequestUrl ? (
                      <Box
                        component="a"
                        href={selectedPullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                        sx={{
                          color: "inherit",
                          textDecoration: "underline",
                          wordBreak: "break-all"
                        }}
                      >
                        {selectedPullRequestUrl}
                      </Box>
                    ) : (
                      "N/A"
                    )}
                  </Typography>
                </Stack>
              </DetailSection>

              <DetailSection title="Acceptance Criteria" icon={<RuleRounded />} defaultExpanded>
                {selectedAcceptanceCriteria.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No acceptance criteria recorded.
                  </Typography>
                )}
                {selectedAcceptanceCriteria.length > 0 && (
                  <Box component="ul" sx={{ pl: 2, m: 0 }}>
                    {selectedAcceptanceCriteria.map((criterion) => (
                      <Typography component="li" key={criterion} variant="body2">
                        {criterion}
                      </Typography>
                    ))}
                  </Box>
                )}
              </DetailSection>

              <DetailSection title="References" icon={<LinkRounded />} defaultExpanded>
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    References ({selectedTaskReferences.length})
                  </Typography>
                  {selectedTaskReferences.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No reference links recorded.
                    </Typography>
                  )}
                  {selectedTaskReferences.map((reference) => (
                    <Box
                      key={reference}
                      component="a"
                      href={reference}
                      target="_blank"
                      rel="noreferrer"
                      sx={{
                        color: "inherit",
                        textDecoration: "underline",
                        wordBreak: "break-all"
                      }}
                    >
                      {reference}
                    </Box>
                  ))}
                </Stack>
              </DetailSection>

              <DetailSection title="Task Dependencies" icon={<HubRounded />} defaultExpanded>
                <Typography variant="body2" color="text.secondary">
                  {selectedTaskIsBlocked ? "Blocked by dependencies." : "No blocking dependencies."}
                </Typography>
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    Dependencies ({selectedTaskDependencies.length})
                  </Typography>
                  {selectedTaskDependencies.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      None
                    </Typography>
                  )}
                  {selectedTaskDependencies.map((taskId) => {
                    const relatedTask = tasksById.get(taskId);
                    const display = relatedTask ? `${getTaskDisplayId(relatedTask)} - ${relatedTask.title}` : taskId;
                    return (
                      <Button
                        key={`dependency-${taskId}`}
                        variant="outlined"
                        size="small"
                        sx={{ justifyContent: "flex-start" }}
                        onClick={() => openTaskDetails(taskId)}
                        aria-label={`Open related task ${display}`}
                      >
                        {display}
                      </Button>
                    );
                  })}
                </Stack>
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    Dependents ({selectedTaskDependents.length})
                  </Typography>
                  {selectedTaskDependents.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      None
                    </Typography>
                  )}
                  {selectedTaskDependents.map((taskId) => {
                    const relatedTask = tasksById.get(taskId);
                    const display = relatedTask ? `${getTaskDisplayId(relatedTask)} - ${relatedTask.title}` : taskId;
                    return (
                      <Button
                        key={`dependent-${taskId}`}
                        variant="outlined"
                        size="small"
                        sx={{ justifyContent: "flex-start" }}
                        onClick={() => openTaskDetails(taskId)}
                        aria-label={`Open related task ${display}`}
                      >
                        {display}
                      </Button>
                    );
                  })}
                </Stack>
              </DetailSection>

              <DetailSection title="Plan" icon={<RuleRounded />}>
                {planningGoals.length === 0 && planningSteps.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No planning artifact recorded.
                  </Typography>
                )}
                {planningGoals.length > 0 && (
                  <Box component="ul" sx={{ pl: 2, m: 0 }}>
                    {planningGoals.map((goal) => (
                      <Typography component="li" key={goal} variant="body2">
                        {goal}
                      </Typography>
                    ))}
                  </Box>
                )}
                {planningSteps.length > 0 && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      Implementation steps
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {planningSteps.map((step) => (
                        <Typography component="li" key={step} variant="body2">
                          {step}
                        </Typography>
                      ))}
                    </Box>
                  </>
                )}
              </DetailSection>

              <DetailSection title="Testing Traceability" icon={<ManageSearchRounded />}>
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Planned items ({plannedTestingItemCount}) | Implemented evidence ({implementedTestingItemCount})
                  </Typography>
                  {plannedTestingItemCount === 0 && implementedTestingItemCount === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No testing artifacts recorded.
                    </Typography>
                  )}
                  {plannedGherkinScenarios.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Planned Gherkin scenarios
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {plannedGherkinScenarios.map((scenario) => (
                          <Typography component="li" key={scenario} variant="body2">
                            {scenario}
                          </Typography>
                        ))}
                      </Box>
                    </>
                  )}
                  {plannedUnitTestIntent.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Planned unit-test intent
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {plannedUnitTestIntent.map((intent) => (
                          <Typography component="li" key={intent} variant="body2">
                            {intent}
                          </Typography>
                        ))}
                      </Box>
                    </>
                  )}
                  {plannedIntegrationTestIntent.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Planned integration-test intent
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {plannedIntegrationTestIntent.map((intent) => (
                          <Typography component="li" key={intent} variant="body2">
                            {intent}
                          </Typography>
                        ))}
                      </Box>
                    </>
                  )}
                  {plannedTestingNotes && (
                    <Typography variant="body2">Plan notes: {plannedTestingNotes}</Typography>
                  )}
                  {implementedTests.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Implemented tests
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {implementedTests.map((testPath) => (
                          <Typography component="li" key={testPath} variant="body2">
                            {testPath}
                          </Typography>
                        ))}
                      </Box>
                    </>
                  )}
                  {implementedEvidenceLinks.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Evidence links
                      </Typography>
                      <Stack spacing={0.5}>
                        {implementedEvidenceLinks.map((link) => (
                          <Box
                            key={link}
                            component="a"
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            sx={{
                              color: "inherit",
                              textDecoration: "underline",
                              wordBreak: "break-all"
                            }}
                          >
                            {link}
                          </Box>
                        ))}
                      </Stack>
                    </>
                  )}
                  {implementedCommandsRun.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Commands run
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {implementedCommandsRun.map((command) => (
                          <Typography component="li" key={command} variant="body2">
                            {command}
                          </Typography>
                        ))}
                      </Box>
                    </>
                  )}
                  {implementedTestingNotes && (
                    <Typography variant="body2">Implementation notes: {implementedTestingNotes}</Typography>
                  )}
                </Stack>
              </DetailSection>

              <DetailSection title="Retrospectives" icon={<ManageSearchRounded />}>
                {selectedRetrospectives.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No retrospectives recorded.
                  </Typography>
                )}
                <Stack spacing={1}>
                  {selectedRetrospectives.map((entry, index) => {
                    const scope = asString(entry.scope) ?? "Retrospective";
                    const createdAt = asString(entry.createdAt);
                    const wentWell = asStringArray(entry.wentWell);
                    const didNotGoWell = asStringArray(entry.didNotGoWell);
                    const couldBeBetter = asStringArray(entry.couldBeBetter);
                    return (
                      <Card key={`retrospective-${index}`} variant="outlined">
                        <CardContent sx={{ "&:last-child": { pb: 1.5 } }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {scope}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {createdAt ? new Date(createdAt).toLocaleString() : "Timestamp unavailable"}
                          </Typography>
                          {wentWell.length > 0 && (
                            <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
                              {wentWell.map((item) => (
                                <Typography component="li" key={`retrospective-good-${item}`} variant="body2">
                                  {item}
                                </Typography>
                              ))}
                            </Box>
                          )}
                          {didNotGoWell.length > 0 && (
                            <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
                              {didNotGoWell.map((item) => (
                                <Typography component="li" key={`retrospective-bad-${item}`} variant="body2">
                                  {item}
                                </Typography>
                              ))}
                            </Box>
                          )}
                          {couldBeBetter.length > 0 && (
                            <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
                              {couldBeBetter.map((item) => (
                                <Typography component="li" key={`retrospective-better-${item}`} variant="body2">
                                  {item}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </DetailSection>

              <DetailSection title="Questionnaire" icon={<ManageSearchRounded />}>
                {selectedAwaitingHumanArtifact ? (
                  <Stack spacing={1}>
                    {typeof selectedAwaitingHumanArtifact.question === "string" && (
                      <Typography variant="body2">
                        {selectedAwaitingHumanArtifact.question}
                      </Typography>
                    )}
                    {typeof selectedAwaitingHumanArtifact.blockingReason === "string" && (
                      <Typography variant="caption" color="text.secondary">
                        Blocking reason: {selectedAwaitingHumanArtifact.blockingReason}
                      </Typography>
                    )}
                    {typeof selectedAwaitingHumanArtifact.recommendedDefault === "string" && (
                      <Typography variant="caption" color="text.secondary">
                        Recommended default: {selectedAwaitingHumanArtifact.recommendedDefault}
                      </Typography>
                    )}
                    {questionnaireOptions.length > 0 && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {questionnaireOptions.map((option) => (
                          <Chip key={option} label={option} size="small" />
                        ))}
                      </Stack>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No questionnaire state recorded.
                  </Typography>
                )}
              </DetailSection>

              <DetailSection title="Answer Thread" icon={<HistoryRounded />}>
                {selectedAnswerThread.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No human answers recorded.
                  </Typography>
                )}
                {selectedAnswerThread.map((entry, index) => (
                  <Card key={`${entry.actor}-${entry.message}-${index}`} variant="outlined">
                    <CardContent sx={{ "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">
                        {entry.actor}
                        {entry.timestamp ? ` | ${new Date(entry.timestamp).toLocaleString()}` : ""}
                      </Typography>
                      <Typography variant="body2">{entry.message}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </DetailSection>

              <DetailSection title="Actions" icon={<EditNoteRounded />}>
                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Human Status Update
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel id="task-status-select-label">Update status</InputLabel>
                    <Select
                      native
                      labelId="task-status-select-label"
                      value={selectedStatus}
                      label="Update status"
                      onChange={(event) => setSelectedStatus(event.target.value as TaskStatus)}
                      inputProps={{ "aria-label": "Update status" }}
                    >
                      {columns.map((column) => (
                        <option key={column.status} value={column.status}>
                          {column.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Transition note (optional)"
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    multiline
                    minRows={2}
                  />
                  <Button
                    variant="contained"
                    onClick={() => void handleStatusUpdate()}
                    disabled={statusUpdating || selectedStatus === selectedTask.status}
                  >
                    Save Status Change
                  </Button>
                  {statusUpdateError && <Alert severity="error">{statusUpdateError}</Alert>}
                </Stack>
              </DetailSection>
            </Stack>
          )}
        </Box>
      </Drawer>

      <Drawer anchor="right" open={statusDetailsOpen} onClose={closeStatusDetails}>
        <Box sx={{ width: { xs: "100vw", sm: 460 }, p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={0.5}>
              <Typography variant="h6">{`Status Details: ${
                statusDetailsModel?.label ??
                columns.find((column) => column.status === statusDetailsStatus)?.label ??
                statusDetailsStatus
              }`}</Typography>
              <IconButton
                size="small"
                aria-label="Close status details"
                onClick={closeStatusDetails}
                sx={{ mt: -0.25, mr: -0.25 }}
              >
                <CloseRounded />
              </IconButton>
            </Stack>

            <DetailSection title="Transition Rules" icon={<RuleRounded />} defaultExpanded>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Allowed transitions
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {(statusDetailsModel?.allowedTransitions ?? []).map((status) => {
                      const label = columns.find((column) => column.status === status)?.label ?? status;
                      return <Chip key={`allowed-${status}`} size="small" label={label} />;
                    })}
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Blocked or conditionally blocked transitions
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {(statusDetailsModel?.blockedTransitions ?? []).map((blocked) => {
                      const label =
                        columns.find((column) => column.status === blocked.status)?.label ?? blocked.status;
                      return (
                        <Box key={`blocked-${blocked.status}`}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {blocked.reasonCodes.join(", ")}
                          </Typography>
                        </Box>
                      );
                    })}
                    {(statusDetailsModel?.blockedTransitions.length ?? 0) === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No blocked transitions recorded.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </DetailSection>

            <DetailSection title="Hooks" icon={<ManageSearchRounded />} defaultExpanded>
              <TableContainer>
                <Table size="small" aria-label="Status hook summary">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, borderBottom: 0, px: 0 }}>
                        Configured onEnter hooks
                      </TableCell>
                      <TableCell sx={{ borderBottom: 0, px: 0 }}>
                        {statusDetailsModel?.hookSummary.onEnterCount ?? 0}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, borderBottom: 0, px: 0 }}>
                        Configured onExit hooks
                      </TableCell>
                      <TableCell sx={{ borderBottom: 0, px: 0 }}>
                        {statusDetailsModel?.hookSummary.onExitCount ?? 0}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, borderBottom: 0, px: 0 }}>
                        Task runtime onEnter entries
                      </TableCell>
                      <TableCell sx={{ borderBottom: 0, px: 0 }}>
                        {statusDetailsOnEnterActionCount}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, borderBottom: 0, px: 0 }}>
                        Task runtime onExit entries
                      </TableCell>
                      <TableCell sx={{ borderBottom: 0, px: 0 }}>
                        {statusDetailsOnExitActionCount}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </DetailSection>

            <DetailSection title="Task Audit Timeline" icon={<HistoryRounded />} defaultExpanded>
              {!statusDetailsTask && (
                <Typography variant="body2" color="text.secondary">
                  Open this view from a task status pill to see task-scoped audit history.
                </Typography>
              )}
              {statusDetailsTask && (
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Showing events for task {getTaskDisplayId(statusDetailsTask)}
                  </Typography>
                  {statusDetailsAuditEvents.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No audit events found for this task.
                    </Typography>
                  )}
                  {statusDetailsAuditEvents.map((event) => (
                    <Card key={`status-audit-${event.id}`} variant="outlined">
                      <CardContent sx={{ "&:last-child": { pb: 1.5 } }}>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(event.timestamp).toLocaleString()} | {event.actor}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {event.eventType}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </DetailSection>
          </Stack>
        </Box>
      </Drawer>
    </Stack>
  );
}

export function App() {
  const [activeView, setActiveView] = useState<ViewName>(() =>
    resolveViewFromLocation()
  );

  useEffect(() => {
    const onPopState = () => {
      setActiveView(resolveViewFromLocation());
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateToView = (nextView: ViewName) => {
    setActiveView(nextView);
    syncViewToLocation(nextView);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 4, md: 8 },
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: "\"\"",
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 85% 5%, rgba(30, 144, 255, 0.18), transparent 45%), radial-gradient(circle at 10% 95%, rgba(26, 163, 122, 0.2), transparent 35%)"
        }
      }}
    >
      <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h3">Haze Agent Monitor</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Orchestrator dashboard and Kanban workflow board for agent execution.
              </Typography>
            </Box>
            <ModeToggle />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant={activeView === "dashboard" ? "contained" : "outlined"}
              startIcon={<WindowRounded />}
              onClick={() => navigateToView("dashboard")}
            >
              Dashboard
            </Button>
            <Button
              variant={activeView === "kanban" ? "contained" : "outlined"}
              startIcon={<ViewKanbanRounded />}
              onClick={() => navigateToView("kanban")}
            >
              Kanban Board
            </Button>
          </Stack>

          {activeView === "dashboard" ? <DashboardView /> : <KanbanView />}
        </Stack>
      </Container>
    </Box>
  );
}

