import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Paper,
  CircularProgress,
  Alert,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import { Refresh as RefreshIcon, Warning as WarningIcon } from "@mui/icons-material";
import { getWorkflowAnalytics, type DefinitionMetrics, type StepMetrics } from "../api.js";

const getHealthScoreColor = (score: number): "success" | "warning" | "error" => {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
};

const getSuccessRateColor = (rate: number): "success" | "warning" | "error" => {
  if (rate >= 0.7) return "success";
  if (rate >= 0.5) return "warning";
  return "error";
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms).toString()}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const formatTokens = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
};

interface StepDetailProps {
  step: StepMetrics;
}

const StepDetail: React.FC<StepDetailProps> = ({ step }) => {
  const isUnreliable = step.successRate < 0.7;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="subtitle2">{step.stepId}</Typography>
          {isUnreliable && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "error.main" }}>
              <WarningIcon fontSize="small" />
              <Typography variant="caption">Low reliability</Typography>
            </Box>
          )}
        </Box>
        <Typography variant="caption" color="textSecondary" sx={{ display: "block", mb: 2 }}>
          {step.stepType} • {step.totalRuns} runs
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption">Success Rate</Typography>
            <Typography variant="caption">
              {(step.successRate * 100).toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={step.successRate * 100}
            color={getSuccessRateColor(step.successRate)}
            sx={{ height: 6, borderRadius: 1 }}
          />
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mt: 1 }}>
          <Box>
            <Typography variant="caption" color="textSecondary">
              Median Duration
            </Typography>
            <Typography variant="body2">{formatDuration(step.medianDurationMs)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="textSecondary">
              P95 Duration
            </Typography>
            <Typography variant="body2">{formatDuration(step.p95DurationMs)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="textSecondary">
              Avg Retries
            </Typography>
            <Typography variant="body2">{step.avgRetryCount.toFixed(2)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="textSecondary">
              Avg Tokens
            </Typography>
            <Typography variant="body2">
              {formatTokens(Math.round(step.avgInputTokens + step.avgOutputTokens))}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

interface DefinitionCardProps {
  definition: DefinitionMetrics;
}

const DefinitionCard: React.FC<DefinitionCardProps> = ({ definition }) => {
  const unreliableSteps = definition.steps.filter((s: StepMetrics) => s.successRate < 0.7);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h6">{definition.definitionName}</Typography>
          <Typography variant="caption" color="textSecondary">
            {definition.totalRuns} runs
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="caption" color="textSecondary">
            Health Score
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <Chip
              label={`${definition.healthScore.toString()}/100`}
              color={getHealthScoreColor(definition.healthScore)}
              variant="filled"
            />
          </Box>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption">Overall Success Rate</Typography>
          <Typography variant="caption">
            {(definition.successRate * 100).toFixed(1)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={definition.successRate * 100}
          color={getSuccessRateColor(definition.successRate)}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>

      {unreliableSteps.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {unreliableSteps.length} step(s) with success rate below 70%
        </Alert>
      )}

      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Steps
      </Typography>
      {definition.steps.map((step) => (
        <StepDetail key={step.stepId} step={step} />
      ))}
    </Paper>
  );
};

interface AnalyticsFiltersProps {
  analytics: DefinitionMetrics[];
  selectedDefinition: string;
  sinceDays: number;
  onDefinitionChange: (v: string) => void;
  onSinceDaysChange: (v: number) => void;
}

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  analytics, selectedDefinition, sinceDays, onDefinitionChange, onSinceDaysChange
}) => (
  <Paper sx={{ p: 3, mb: 4 }}>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
      <FormControl fullWidth size="small">
        <InputLabel>Definition</InputLabel>
        <Select value={selectedDefinition} onChange={(e) => { onDefinitionChange(e.target.value); }} label="Definition">
          <MenuItem value="">All Definitions</MenuItem>
          {analytics.map((a) => (
            <MenuItem key={a.definitionName} value={a.definitionName}>{a.definitionName}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth size="small">
        <InputLabel>Last N Days</InputLabel>
        <Select value={sinceDays} onChange={(e) => { onSinceDaysChange(e.target.value); }} label="Last N Days">
          <MenuItem value={7}>7 days</MenuItem>
          <MenuItem value={14}>14 days</MenuItem>
          <MenuItem value={30}>30 days</MenuItem>
          <MenuItem value={90}>90 days</MenuItem>
        </Select>
      </FormControl>
    </Box>
  </Paper>
);

export const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<DefinitionMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<string>("");
  const [sinceDays, setSinceDays] = useState<number>(30);

  const fetchAnalytics = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
      setAnalytics(await getWorkflowAnalytics(selectedDefinition || undefined, since));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchAnalytics(); }, [selectedDefinition, sinceDays]);

  const filteredAnalytics = selectedDefinition
    ? analytics.filter((a) => a.definitionName === selectedDefinition)
    : analytics;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Typography variant="h4">Workflow Analytics</Typography>
        <Button startIcon={<RefreshIcon />} onClick={() => { void fetchAnalytics(); }} variant="outlined">
          Refresh
        </Button>
      </Box>
      <AnalyticsFilters
        analytics={analytics}
        selectedDefinition={selectedDefinition}
        sinceDays={sinceDays}
        onDefinitionChange={setSelectedDefinition}
        onSinceDaysChange={setSinceDays}
      />
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && filteredAnalytics.length === 0 && (
        <Alert severity="info">No analytics data available for the selected filters</Alert>
      )}
      {!loading && !error && filteredAnalytics.map((definition: DefinitionMetrics) => (
        <DefinitionCard key={definition.definitionName} definition={definition} />
      ))}
    </Container>
  );
};
