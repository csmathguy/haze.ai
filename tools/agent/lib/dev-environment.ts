export type DevCheckoutMode = "main";
export type DevEnvironmentId = "all" | "audit" | "code-review" | "knowledge" | "plan" | "taxes";
export type DevProductId = Exclude<DevEnvironmentId, "all">;
export type DevServiceId =
  | "audit-api"
  | "audit-web"
  | "code-review-api"
  | "code-review-web"
  | "knowledge-api"
  | "knowledge-web"
  | "plan-api"
  | "plan-web"
  | "taxes-api"
  | "taxes-web";
export type DevServiceKind = "api" | "web";

export interface ParsedDevEnvironmentArgs {
  checkout: DevCheckoutMode;
  dryRun: boolean;
  environmentIds: DevEnvironmentId[];
}

export interface DevServiceDefinition {
  appId: DevProductId;
  healthUrl?: string;
  id: DevServiceId;
  kind: DevServiceKind;
  label: string;
  primaryUrl: string;
  workspace: string;
}

export interface DevEnvironmentDefinition {
  description: string;
  id: DevProductId;
  label: string;
  serviceIds: readonly DevServiceId[];
}

export interface DevServiceLaunchPlan extends DevServiceDefinition {
  commandArgs: string[];
}

export interface DevEnvironmentPlan {
  checkout: DevCheckoutMode;
  checkoutRoot: string;
  environments: DevEnvironmentDefinition[];
  services: DevServiceLaunchPlan[];
}

const SERVICE_DEFINITIONS: readonly DevServiceDefinition[] = [
  {
    appId: "taxes",
    healthUrl: "http://127.0.0.1:3040/api/health",
    id: "taxes-api",
    kind: "api",
    label: "Taxes API",
    primaryUrl: "http://127.0.0.1:3040",
    workspace: "@taxes/api"
  },
  {
    appId: "taxes",
    id: "taxes-web",
    kind: "web",
    label: "Taxes Web",
    primaryUrl: "http://127.0.0.1:5173",
    workspace: "@taxes/web"
  },
  {
    appId: "plan",
    healthUrl: "http://127.0.0.1:3140/api/health",
    id: "plan-api",
    kind: "api",
    label: "Plan API",
    primaryUrl: "http://127.0.0.1:3140",
    workspace: "@taxes/plan-api"
  },
  {
    appId: "plan",
    id: "plan-web",
    kind: "web",
    label: "Plan Web",
    primaryUrl: "http://127.0.0.1:5175",
    workspace: "@taxes/plan-web"
  },
  {
    appId: "audit",
    healthUrl: "http://127.0.0.1:3180/api/health",
    id: "audit-api",
    kind: "api",
    label: "Audit API",
    primaryUrl: "http://127.0.0.1:3180",
    workspace: "@taxes/audit-api"
  },
  {
    appId: "audit",
    id: "audit-web",
    kind: "web",
    label: "Audit Web",
    primaryUrl: "http://127.0.0.1:5174",
    workspace: "@taxes/audit-web"
  },
  {
    appId: "knowledge",
    healthUrl: "http://127.0.0.1:3240/api/health",
    id: "knowledge-api",
    kind: "api",
    label: "Knowledge API",
    primaryUrl: "http://127.0.0.1:3240",
    workspace: "@taxes/knowledge-api"
  },
  {
    appId: "knowledge",
    id: "knowledge-web",
    kind: "web",
    label: "Knowledge Web",
    primaryUrl: "http://127.0.0.1:5177",
    workspace: "@taxes/knowledge-web"
  },
  {
    appId: "code-review",
    healthUrl: "http://127.0.0.1:3142/api/health",
    id: "code-review-api",
    kind: "api",
    label: "Code Review API",
    primaryUrl: "http://127.0.0.1:3142",
    workspace: "@taxes/code-review-api"
  },
  {
    appId: "code-review",
    id: "code-review-web",
    kind: "web",
    label: "Code Review Web",
    primaryUrl: "http://127.0.0.1:5178",
    workspace: "@taxes/code-review-web"
  }
] as const;

const ENVIRONMENT_DEFINITIONS: readonly DevEnvironmentDefinition[] = [
  {
    description: "Tax workflow document intake, workspace review, and filing support surfaces.",
    id: "taxes",
    label: "Taxes",
    serviceIds: ["taxes-api", "taxes-web"]
  },
  {
    description: "Planning backlog API and React workspace.",
    id: "plan",
    label: "Plan",
    serviceIds: ["plan-api", "plan-web"]
  },
  {
    description: "Shared audit API and live monitor.",
    id: "audit",
    label: "Audit",
    serviceIds: ["audit-api", "audit-web"]
  },
  {
    description: "Knowledge API and memory browser.",
    id: "knowledge",
    label: "Knowledge",
    serviceIds: ["knowledge-api", "knowledge-web"]
  },
  {
    description: "Code review API and walkthrough UI.",
    id: "code-review",
    label: "Code Review",
    serviceIds: ["code-review-api", "code-review-web"]
  }
] as const;

const ENVIRONMENT_DEFINITION_MAP = new Map(ENVIRONMENT_DEFINITIONS.map((environment) => [environment.id, environment]));
const SERVICE_DEFINITION_MAP = new Map(SERVICE_DEFINITIONS.map((service) => [service.id, service]));
const ALL_ENVIRONMENT_IDS = ENVIRONMENT_DEFINITIONS.map((environment) => environment.id);

export function parseDevEnvironmentArgs(
  rawArgs: string[],
  options: {
    requireEnvironmentSelection: boolean;
  }
): ParsedDevEnvironmentArgs {
  const parsed: ParsedDevEnvironmentArgs = {
    checkout: "main",
    dryRun: false,
    environmentIds: []
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const current = rawArgs[index];

    if (current === undefined) {
      throw new Error("Unknown empty argument.");
    }

    if (current === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (current === "--checkout") {
      const value = readFlagValue(rawArgs, index, current);
      parsed.checkout = parseCheckoutMode(value);
      index += 1;
      continue;
    }

    if (current === "--environment" || current === "--env") {
      const value = readFlagValue(rawArgs, index, current);
      parsed.environmentIds.push(parseEnvironmentId(value));
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  parsed.environmentIds = normalizeEnvironmentIds(parsed.environmentIds);

  if (options.requireEnvironmentSelection && parsed.environmentIds.length === 0) {
    throw new Error("Select at least one environment with --environment <name>.");
  }

  return parsed;
}

export function createDevEnvironmentPlan(
  args: ParsedDevEnvironmentArgs,
  checkoutRoots: Record<DevCheckoutMode, string>
): DevEnvironmentPlan {
  const environmentIds = normalizeEnvironmentIds(args.environmentIds);
  const environments = environmentIds.map((environmentId) => {
    const environment = ENVIRONMENT_DEFINITION_MAP.get(environmentId);

    if (environment === undefined) {
      throw new Error(`Unknown environment: ${environmentId}`);
    }

    return environment;
  });
  const services = environments.flatMap((environment) =>
    environment.serviceIds.map((serviceId) => {
      const service = SERVICE_DEFINITION_MAP.get(serviceId);

      if (service === undefined) {
        throw new Error(`Unknown service: ${serviceId}`);
      }

      return {
        ...service,
        commandArgs: ["run", "dev", `--workspace=${service.workspace}`]
      };
    })
  );

  return {
    checkout: args.checkout,
    checkoutRoot: checkoutRoots[args.checkout],
    environments,
    services
  };
}

export function renderDevEnvironmentCatalog(): string {
  const lines = ["Available environments:"];

  for (const environment of ENVIRONMENT_DEFINITIONS) {
    lines.push(`- ${environment.id}: ${environment.description}`);

    for (const serviceId of environment.serviceIds) {
      const service = SERVICE_DEFINITION_MAP.get(serviceId);

      if (service === undefined) {
        continue;
      }

      const healthSegment = service.healthUrl === undefined ? "" : ` | health ${service.healthUrl}`;
      lines.push(`  ${service.id} -> ${service.primaryUrl}${healthSegment}`);
    }
  }

  lines.push("- all: every environment listed above");
  lines.push("");
  lines.push("Examples:");
  lines.push("- npm run dev:env -- --environment taxes");
  lines.push("- npm run dev:env -- --environment audit --environment plan");
  lines.push("- npm run dev:env -- --environment all --dry-run");

  return lines.join("\n");
}

export function renderDevEnvironmentPlan(plan: DevEnvironmentPlan): string {
  const lines = [
    `Checkout: ${plan.checkout}`,
    `Checkout Root: ${plan.checkoutRoot}`,
    `Environments: ${plan.environments.map((environment) => environment.id).join(", ")}`,
    "Services:"
  ];

  for (const service of plan.services) {
    const healthSegment = service.healthUrl === undefined ? "" : ` | health ${service.healthUrl}`;
    lines.push(`- ${service.id}: ${service.primaryUrl}${healthSegment}`);
    lines.push(`  command: npm ${service.commandArgs.join(" ")}`);
  }

  return lines.join("\n");
}

export function getEnvironmentDefinitions(): readonly DevEnvironmentDefinition[] {
  return ENVIRONMENT_DEFINITIONS;
}

function readFlagValue(rawArgs: string[], index: number, flagName: string): string {
  const value = rawArgs[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value after ${flagName}.`);
  }

  return value;
}

function parseCheckoutMode(value: string): DevCheckoutMode {
  if (value !== "main") {
    throw new Error(`Unsupported checkout "${value}". Only "main" is available in this slice.`);
  }

  return value;
}

function parseEnvironmentId(value: string): DevEnvironmentId {
  if (value === "all") {
    return value;
  }

  const normalized = ALL_ENVIRONMENT_IDS.find((environmentId) => environmentId === value);

  if (normalized === undefined) {
    throw new Error(`Unknown environment "${value}".`);
  }

  return normalized;
}

function normalizeEnvironmentIds(environmentIds: DevEnvironmentId[]): DevProductId[] {
  const expanded = environmentIds.includes("all") ? ALL_ENVIRONMENT_IDS : environmentIds.filter(isProductEnvironmentId);

  return [...new Set(expanded)];
}

function isProductEnvironmentId(value: DevEnvironmentId): value is DevProductId {
  return value !== "all";
}
