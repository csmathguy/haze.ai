import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import { fetchWorkflowDefinitions, type WorkflowDefinitionSummary } from "../api.js";

export function DefinitionList() {
  const [definitions, setDefinitions] = useState<WorkflowDefinitionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadDefinitions();
  }, []);

  async function loadDefinitions(): Promise<void> {
    setIsLoading(true);
    const defns = await fetchWorkflowDefinitions();
    setDefinitions(defns);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <Stack alignItems="center" minHeight={400} justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h2">Workflow Definitions</Typography>
        <Typography variant="body1">
          Workflow definitions define the structure, steps, and rules for automated or semi-automated processes. Click
          a definition to view its graph and execution details.
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardHeader avatar={<DescriptionOutlinedIcon />} title="All Definitions" />
        <CardContent>
          {definitions.length === 0 ? (
            <Alert severity="info">No workflow definitions available yet. They will appear here once created.</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {definitions.map((def) => (
                    <TableRow hover key={def.name} sx={{ cursor: "pointer" }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {def.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography color="textSecondary" variant="body2">
                          {def.description ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{new Date(def.createdAt).toLocaleDateString()}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
