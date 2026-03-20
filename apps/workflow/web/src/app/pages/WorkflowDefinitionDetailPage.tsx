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

import { getWorkflowDefinition, type WorkflowDefinition } from "../api.js";
import { WorkflowGraph } from "../../components/WorkflowGraph.js";

export const WorkflowDefinitionDetailPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    fetchDefinition();
  }, [name]);

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
            <Typography variant="h6">{definition?.name || "Workflow Definition"}</Typography>
            {definition && (
              <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
                v{definition.version}
              </Typography>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: "auto" }}>
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

        {!loading && definition && <WorkflowGraph definition={definition} />}
      </Box>
    </Box>
  );
};
