import { useEffect, useState } from "react";
import { Alert, Card, CardContent, CardHeader, CircularProgress, Stack, Typography } from "@mui/material";
import AutoGraphOutlinedIcon from "@mui/icons-material/AutoGraphOutlined";

import { fetchWorkflowDefinition, type WorkflowDefinitionDetail } from "../api.js";

interface DefinitionDetailProps {
  readonly name: string;
}

export function DefinitionDetail({ name }: DefinitionDetailProps) {
  const [definition, setDefinition] = useState<WorkflowDefinitionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadDefinition();
  }, [name]);

  async function loadDefinition(): Promise<void> {
    setIsLoading(true);
    const def = await fetchWorkflowDefinition(name);
    setDefinition(def);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <Stack alignItems="center" minHeight={400} justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  if (definition === null) {
    return (
      <Stack spacing={3}>
        <Alert severity="error">Workflow definition "{name}" not found.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h2">{definition.name}</Typography>
        {definition.description && (
          <Typography color="textSecondary" variant="body1">
            {definition.description}
          </Typography>
        )}
      </Stack>

      <Card variant="outlined">
        <CardHeader avatar={<AutoGraphOutlinedIcon />} title="Workflow Graph" />
        <CardContent>
          <Alert severity="info">Graph visualization coming soon (PLAN-149). The ReactFlow visualization will display here.</Alert>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader title="Metadata" />
        <CardContent>
          <Stack spacing={2}>
            <Stack>
              <Typography color="textSecondary" variant="caption">
                Created
              </Typography>
              <Typography variant="body2">{new Date(definition.createdAt).toLocaleString()}</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
