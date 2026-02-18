import { randomUUID } from "node:crypto";

export const DEFAULT_PROJECT_ID = "project-default";

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  repository: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  repository?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  repository?: string;
  metadata?: Record<string, unknown>;
}

export class ProjectServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

interface ProjectWorkflowServiceOptions {
  now?: () => Date;
  initialProjects?: ProjectRecord[];
  onChanged?: (projects: ProjectRecord[]) => Promise<void> | void;
}

export class ProjectWorkflowService {
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly now: () => Date;
  private readonly onChanged: (projects: ProjectRecord[]) => Promise<void> | void;

  constructor(options?: ProjectWorkflowServiceOptions) {
    this.now = options?.now ?? (() => new Date());
    this.onChanged = options?.onChanged ?? (() => undefined);
    if (options?.initialProjects?.length) {
      for (const project of options.initialProjects) {
        this.projects.set(project.id, this.cloneProject(project));
      }
    }
    this.ensureDefaultProject();
  }

  list(): ProjectRecord[] {
    return [...this.projects.values()]
      .map((project) => this.cloneProject(project))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(id: string): ProjectRecord {
    const project = this.projects.get(id);
    if (!project) {
      throw new ProjectServiceError(`Project not found: ${id}`, 404);
    }
    return this.cloneProject(project);
  }

  exists(id: string): boolean {
    return this.projects.has(id);
  }

  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    const now = this.now().toISOString();
    const name = this.normalizeName(input.name);

    const duplicate = [...this.projects.values()].find(
      (project) => project.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw new ProjectServiceError(`Project name already exists: ${name}`, 409);
    }

    const record: ProjectRecord = {
      id: randomUUID(),
      name,
      description: input.description?.trim() ?? "",
      repository: input.repository?.trim() ?? "",
      createdAt: now,
      updatedAt: now,
      metadata: { ...(input.metadata ?? {}) }
    };
    this.projects.set(record.id, record);
    await this.commitChange();
    return this.cloneProject(record);
  }

  async update(id: string, input: UpdateProjectInput): Promise<ProjectRecord> {
    const existing = this.projects.get(id);
    if (!existing) {
      throw new ProjectServiceError(`Project not found: ${id}`, 404);
    }

    if (input.name !== undefined) {
      existing.name = this.normalizeName(input.name);
    }
    if (input.description !== undefined) {
      existing.description = input.description.trim();
    }
    if (input.repository !== undefined) {
      existing.repository = input.repository.trim();
    }
    if (input.metadata !== undefined) {
      existing.metadata = { ...input.metadata };
    }
    existing.updatedAt = this.now().toISOString();

    await this.commitChange();
    return this.cloneProject(existing);
  }

  async delete(id: string): Promise<void> {
    if (id === DEFAULT_PROJECT_ID) {
      throw new ProjectServiceError("Default project cannot be deleted", 409);
    }
    if (!this.projects.has(id)) {
      throw new ProjectServiceError(`Project not found: ${id}`, 404);
    }
    this.projects.delete(id);
    await this.commitChange();
  }

  ensureDefaultProject(): void {
    if (this.projects.has(DEFAULT_PROJECT_ID)) {
      return;
    }

    const now = this.now().toISOString();
    this.projects.set(DEFAULT_PROJECT_ID, {
      id: DEFAULT_PROJECT_ID,
      name: "General",
      description: "Default project used for legacy or uncategorized tasks.",
      repository: "",
      createdAt: now,
      updatedAt: now,
      metadata: {
        system: true
      }
    });
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();
    if (!normalized) {
      throw new ProjectServiceError("Project name is required", 400);
    }
    return normalized;
  }

  private cloneProject(project: ProjectRecord): ProjectRecord {
    return {
      ...project,
      metadata: { ...project.metadata }
    };
  }

  private async commitChange(): Promise<void> {
    await this.onChanged(this.list());
  }
}

