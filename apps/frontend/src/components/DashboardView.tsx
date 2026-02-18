import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import { useEffect, useReducer } from "react";
import {
  fetchRecentAudit,
  fetchStatus,
  postJson,
  subscribeAudit,
  type AuditEventRecord,
  type OrchestratorStatus
} from "../api";

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

export function DashboardView() {
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
