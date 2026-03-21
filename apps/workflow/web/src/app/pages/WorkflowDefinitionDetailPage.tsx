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

import { getWorkflowDefinition, type WorkflowDefinition, type WorkflowRun } from "../api.js";
import { WorkflowGraph } from "../../components/WorkflowGraph.js";
import { RunSelector } from "../../components/RunSelector.js";

interface HeaderProps {
  definition: WorkflowDefinition | null;
  onBack: () => void;
}

const Header: React.FC<HeaderProps> = ({ definition, onBack }) => (
  <AppBar position="static">
    <Toolbar>
      <IconButton edge="start" color="inherit" onClick={onBack} sx={{ mr: 2 }}>
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
);

interface ContentProps {
  loading: boolean;
  error: string | null;
  definition: WorkflowDefinition | null;
  selectedRun: WorkflowRun | null;
  onRunSelected: (run: WorkflowRun | null) => void;
}

const Content: React.FC<ContentProps> = ({ loading, error, definition, selectedRun, onRunSelected }) => {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ pt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!definition) return null;

  const runOverlay = selectedRun?.stepRuns && selectedRun.stepRuns.length > 0
    ? { stepRuns: selectedRun.stepRuns, runStatus: selectedRun.status }
    : undefined;

  return (
    <Container maxWidth="lg" sx={{ py: 3, display: "flex", flexDirection: "column", gap: 2 }}>
      <RunSelector definitionName={definition.name} onRunSelected={onRunSelected} />
      <Box sx={{ flex: 1, minHeight: 600, height: 600, position: "relative" }}>
        <WorkflowGraph definition={definition} runOverlay={runOverlay} />
      </Box>
    </Container>
  );
};

export const WorkflowDefinitionDetailPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header definition={definition} onBack={() => { navigate("/definitions"); }} />
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <Content loading={loading} error={error} definition={definition} selectedRun={selectedRun} onRunSelected={setSelectedRun} />
      </Box>
    </Box>
  );
};
