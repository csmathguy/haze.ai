import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import { Alert, Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import {
  createProject,
  fetchProjects,
  patchProject,
  type ProjectRecord,
  type ProjectRequirementType
} from "../api";

interface RequirementDraftState {
  title: string;
  description: string;
  type: ProjectRequirementType;
  status: string;
  priority: string;
}

const defaultRequirementDraft = (): RequirementDraftState => ({
  title: "",
  description: "",
  type: "functional",
  status: "proposed",
  priority: ""
});

const getRequirementTypeLabel = (type: ProjectRequirementType): string =>
  type === "functional" ? "Functional" : "Non-functional";

export function ProjectsView() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repository, setRepository] = useState("");
  const [requirementDrafts, setRequirementDrafts] = useState<Record<string, RequirementDraftState>>({});

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

  const getRequirementDraft = (projectId: string): RequirementDraftState =>
    requirementDrafts[projectId] ?? defaultRequirementDraft();

  const setRequirementDraft = (
    projectId: string,
    updater: (current: RequirementDraftState) => RequirementDraftState
  ) => {
    setRequirementDrafts((current) => {
      const nextDraft = updater(current[projectId] ?? defaultRequirementDraft());
      return {
        ...current,
        [projectId]: nextDraft
      };
    });
  };

  const handleAddRequirement = async (project: ProjectRecord) => {
    const draft = getRequirementDraft(project.id);
    const title = draft.title.trim();
    if (title.length === 0) {
      setError("Requirement title is required.");
      return;
    }

    const parsedPriority = draft.priority.trim().length > 0 ? Number(draft.priority.trim()) : null;
    if (parsedPriority !== null && (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 5)) {
      setError("Requirement priority must be an integer from 1 to 5.");
      return;
    }

    setError(null);
    try {
      await patchProject(project.id, {
        requirements: [
          ...(project.requirements ?? []),
          {
            title,
            description: draft.description.trim(),
            type: draft.type,
            status: draft.status.trim() || "proposed",
            priority: parsedPriority,
            metadata: {}
          }
        ]
      });
      setRequirementDrafts((current) => ({
        ...current,
        [project.id]: defaultRequirementDraft()
      }));
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
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Requirements ({(project.requirements ?? []).length})
                </Typography>
                {(project.requirements ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No requirements recorded.
                  </Typography>
                )}
                {(project.requirements ?? []).map((requirement) => (
                  <Card key={requirement.id} variant="outlined" sx={{ backgroundColor: "background.paper" }}>
                    <CardContent sx={{ "&:last-child": { pb: 1.5 } }}>
                      <Stack spacing={0.75}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {requirement.title}
                        </Typography>
                        {requirement.description.trim().length > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            {requirement.description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                          <Chip size="small" label={getRequirementTypeLabel(requirement.type)} />
                          <Chip size="small" label={`Status: ${requirement.status}`} />
                          <Chip
                            size="small"
                            label={`Priority: ${requirement.priority === null ? "N/A" : requirement.priority}`}
                          />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                <Stack spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Add Requirement
                  </Typography>
                  <TextField
                    size="small"
                    label="Requirement title"
                    value={getRequirementDraft(project.id).title}
                    onChange={(event) =>
                      setRequirementDraft(project.id, (current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                  />
                  <TextField
                    size="small"
                    label="Requirement description"
                    value={getRequirementDraft(project.id).description}
                    onChange={(event) =>
                      setRequirementDraft(project.id, (current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                  />
                  <TextField
                    size="small"
                    label="Requirement type"
                    value={getRequirementDraft(project.id).type}
                    onChange={(event) =>
                      setRequirementDraft(project.id, (current) => ({
                        ...current,
                        type: event.target.value === "non_functional" ? "non_functional" : "functional"
                      }))
                    }
                    helperText="functional or non_functional"
                  />
                  <TextField
                    size="small"
                    label="Requirement status"
                    value={getRequirementDraft(project.id).status}
                    onChange={(event) =>
                      setRequirementDraft(project.id, (current) => ({
                        ...current,
                        status: event.target.value
                      }))
                    }
                  />
                  <TextField
                    size="small"
                    label="Requirement priority"
                    value={getRequirementDraft(project.id).priority}
                    onChange={(event) =>
                      setRequirementDraft(project.id, (current) => ({
                        ...current,
                        priority: event.target.value
                      }))
                    }
                    helperText="Integer 1-5"
                  />
                  <Button variant="outlined" onClick={() => void handleAddRequirement(project)}>
                    Add Requirement
                  </Button>
                </Stack>
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
