import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Alert
} from "@mui/material";

import { listWorkflowDefinitions, type WorkflowDefinition } from "../api.js";

export const WorkflowDefinitionListPage: React.FC = () => {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDefinitions = async () => {
      try {
        setLoading(true);
        const data = await listWorkflowDefinitions();
        setDefinitions(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load definitions");
      } finally {
        setLoading(false);
      }
    };

    void fetchDefinitions();
  }, []);

  const handleSelectDefinition = (name: string) => {
    navigate(`/definitions/${encodeURIComponent(name)}`);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Workflow Definitions
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Browse and view workflow definitions as interactive graphs.
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && definitions.length === 0 && (
        <Alert severity="info">No workflow definitions available.</Alert>
      )}

      {!loading && definitions.length > 0 && (
        <Paper>
          <List>
            {definitions.map((definition, index) => (
              <React.Fragment key={definition.id}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => { handleSelectDefinition(definition.name); }}>
                    <ListItemText
                      primary={definition.name}
                      secondary={`v${definition.version} • ${definition.description ?? "No description"}`}
                    />
                  </ListItemButton>
                </ListItem>
                {index < definitions.length - 1 && <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Container>
  );
};
