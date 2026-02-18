import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createProject, fetchProjects, patchProject, type ProjectRecord } from "../api";

export function ProjectsView() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repository, setRepository] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await fetchProjects();
      setProjects(records);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleCreate = async () => {
    if (name.trim().length === 0) {
      setError("Project name is required.");
      return;
    }
    setError(null);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim(),
        repository: repository.trim()
      });
      setName("");
      setDescription("");
      setRepository("");
      await refresh();
    } catch (createError) {
      setError((createError as Error).message);
    }
  };

  const handleRepositorySave = async (projectId: string, nextRepository: string) => {
    setError(null);
    try {
      await patchProject(projectId, { repository: nextRepository.trim() });
      await refresh();
    } catch (updateError) {
      setError((updateError as Error).message);
    }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography color="text.secondary">
        Define project-level context such as repository metadata and use it across tasks.
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.25}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Add Project
            </Typography>
            <TextField
              size="small"
              label="Project name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              size="small"
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <TextField
              size="small"
              label="Repository"
              placeholder="owner/repo or repository URL"
              value={repository}
              onChange={(event) => setRepository(event.target.value)}
            />
            <Button variant="contained" onClick={() => void handleCreate()}>
              Save Project
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={1.25}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Configured Projects ({projects.length})
        </Typography>
        {projects.map((project) => (
          <Card key={project.id} variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>{project.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {project.description || "No description recorded."}
                </Typography>
                <TextField
                  size="small"
                  label="Repository"
                  defaultValue={project.repository}
                  onBlur={(event) => {
                    if (event.target.value !== project.repository) {
                      void handleRepositorySave(project.id, event.target.value);
                    }
                  }}
                />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Button
        variant="outlined"
        startIcon={<AutorenewRounded />}
        onClick={() => void refresh()}
        disabled={loading}
      >
        Refresh Projects
      </Button>
    </Stack>
  );
}
