import { randomUUID } from "node:crypto";

export const DEFAULT_PROJECT_ID = "project-default";

export type ProjectRequirementType = "functional" | "non_functional";

export interface ProjectRequirementRecord {
  id: string;
  title: string;
  description: string;
  type: ProjectRequirementType;
  status: string;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface ProjectRequirementInput {
  id?: string;
  title: string;
  description?: string;
  type: ProjectRequirementType | "non-functional";
  status?: string;
  priority?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  repository: string;
  requirements: ProjectRequirementRecord[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  repository?: string;
  requirements?: ProjectRequirementInput[];
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  repository?: string;
  requirements?: ProjectRequirementInput[];
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
      requirements: this.normalizeRequirements(input.requirements ?? [], []),
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
    if (input.requirements !== undefined) {
      existing.requirements = this.normalizeRequirements(input.requirements, existing.requirements);
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
      requirements: [],
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
      requirements: (project.requirements ?? []).map((requirement) => ({
        ...requirement,
        metadata: { ...requirement.metadata }
      })),
      metadata: { ...project.metadata }
    };
  }

  private normalizeRequirements(
    input: ProjectRequirementInput[],
    existingRequirements: ProjectRequirementRecord[]
  ): ProjectRequirementRecord[] {
    const now = this.now().toISOString();
    const existingById = new Map(existingRequirements.map((requirement) => [requirement.id, requirement]));
    const seenIds = new Set<string>();

    return input.map((rawRequirement) => {
      const incomingId = rawRequirement.id?.trim() ?? "";
      const requirementId = incomingId || randomUUID();
      const existing = incomingId ? existingById.get(incomingId) : undefined;
      const title = this.normalizeRequirementTitle(rawRequirement.title);
      const status = this.normalizeRequirementStatus(rawRequirement.status);

      if (seenIds.has(requirementId)) {
        throw new ProjectServiceError(
          `Duplicate requirement id in payload: ${requirementId}`,
          400
        );
      }
      seenIds.add(requirementId);

      return {
        id: requirementId,
        title,
        description: rawRequirement.description?.trim() ?? "",
        type: this.normalizeRequirementType(rawRequirement.type),
        status,
        priority: this.normalizeRequirementPriority(rawRequirement.priority),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        metadata: { ...(rawRequirement.metadata ?? {}) }
      };
    });
  }

  private normalizeRequirementTitle(title: string): string {
    const normalized = title.trim();
    if (!normalized) {
      throw new ProjectServiceError("Requirement title is required", 400);
    }
    return normalized;
  }

  private normalizeRequirementStatus(status: string | undefined): string {
    const normalized = status?.trim();
    return normalized && normalized.length > 0 ? normalized : "proposed";
  }

  private normalizeRequirementType(type: ProjectRequirementInput["type"]): ProjectRequirementType {
    const normalized = type.trim().toLowerCase().replaceAll("-", "_");
    if (normalized === "functional" || normalized === "non_functional") {
      return normalized;
    }
    throw new ProjectServiceError(`Invalid requirement type: ${type}`, 400);
  }

  private normalizeRequirementPriority(priority: number | null | undefined): number | null {
    if (priority === null || priority === undefined) {
      return null;
    }
    if (!Number.isFinite(priority) || !Number.isInteger(priority) || priority < 1 || priority > 5) {
      throw new ProjectServiceError("Requirement priority must be an integer from 1 to 5", 400);
    }
    return priority;
  }

  private async commitChange(): Promise<void> {
    await this.onChanged(this.list());
  }
}

