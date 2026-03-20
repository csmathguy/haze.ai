import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Container
} from "@mui/material";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

import { getWorkflowDefinition, getWorkflowRun, type WorkflowDefinition, type WorkflowRunOverlay } from "../api.js";
import { WorkflowGraph } from "../../components/WorkflowGraph.js";
import { RunSelector } from "../../components/RunSelector.js";

function useRunPolling(
  selectedRunId: string | null,
  setRunOverlay: (overlay: WorkflowRunOverlay | null) => void,
  setRunLoading: (loading: boolean) => void
): void {
  useEffect(() => {
    if (!selectedRunId) {
      setRunOverlay(null);
      return;
    }

    let isRunActive = true;
    const fetchRun = async () => {
      try {
        setRunLoading(true);
        const run = await getWorkflowRun(selectedRunId);
        const stepRuns = run.stepRuns ?? [];
        setRunOverlay({ stepRuns, runStatus: run.status });
        isRunActive = run.status === "running" || run.status === "pending";
      } catch (err) {
        console.error("Failed to fetch run:", err);
      } finally {
        setRunLoading(false);
      }
    };

    void fetchRun();

    const pollInterval = setInterval(() => {
      if (isRunActive) {
        void fetchRun();
      }
    }, 4000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [selectedRunId, setRunOverlay, setRunLoading]);
}

export const WorkflowDefinitionDetailPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runOverlay, setRunOverlay] = useState<WorkflowRunOverlay | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  useEffect(() => {
    if (!name) {
      setError("Definition name is required");
      setLoading(false);
      return;
    }

    const fetchDefinition = async () => {
      try {
        setLoading(true);
        const data = await getWorkflowDefinition(decodeURIComponent(name));
        setDefinition(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load definition");
      } finally {
        setLoading(false);
      }
    };

    void fetchDefinition();
  }, [name]);

  useRunPolling(selectedRunId, setRunOverlay, setRunLoading);

  const handleBack = () => {
    navigate("/definitions");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{definition?.name ?? "Workflow Definition"}</Typography>
            {definition && (
              <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
                v{definition.version}
              </Typography>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <PageContent
        loading={loading}
        error={error}
        definition={definition}
        selectedRunId={selectedRunId}
        runOverlay={runOverlay}
        runLoading={runLoading}
        onRunSelected={setSelectedRunId}
      />
    </Box>
  );
};

interface PageContentProps {
  loading: boolean;
  error: string | null;
  definition: WorkflowDefinition | null;
  selectedRunId: string | null;
  runOverlay: WorkflowRunOverlay | null;
  runLoading: boolean;
  onRunSelected: (runId: string | null) => void;
}

const PageContent: React.FC<PageContentProps> = ({
  loading,
  error,
  definition,
  selectedRunId,
  runOverlay,
  runLoading,
  onRunSelected
}) => {
  return (
    <Box sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Container maxWidth="sm" sx={{ pt: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      )}

      {!loading && definition && (
        <>
          <RunSelector
            definitionName={definition.name}
            selectedRunId={selectedRunId}
            onRunSelected={onRunSelected}
          />
          {runLoading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2">Loading run...</Typography>
            </Box>
          )}
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <WorkflowGraph definition={definition} runOverlay={runOverlay ?? undefined} />
          </Box>
        </>
      )}
    </Box>
  );
};
