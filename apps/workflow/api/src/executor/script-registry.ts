export interface RegisteredScript {
  readonly name: string;
  readonly description: string;
  readonly command: string;
  readonly args?: string[];
  readonly timeoutMs?: number;
}

export const SCRIPT_REGISTRY: Record<string, RegisteredScript> = {
  lint: {
    name: "lint",
    description: "Run ESLint",
    command: "npm",
    args: ["run", "lint"],
    timeoutMs: 60000
  },
  typecheck: {
    name: "typecheck",
    description: "Run TypeScript compiler check",
    command: "npm",
    args: ["run", "typecheck"],
    timeoutMs: 120000
  },
  test: {
    name: "test",
    description: "Run all tests",
    command: "npm",
    args: ["test"],
    timeoutMs: 180000
  },
  "test:arch": {
    name: "test:arch",
    description: "Run architecture tests",
    command: "npm",
    args: ["run", "test:arch"],
    timeoutMs: 120000
  },
  "prisma:check": {
    name: "prisma:check",
    description: "Validate Prisma schema and generate client",
    command: "npm",
    args: ["run", "prisma:check"],
    timeoutMs: 60000
  },
  "prisma:validate": {
    name: "prisma:validate",
    description: "Validate Prisma schema",
    command: "npm",
    args: ["run", "prisma:validate"],
    timeoutMs: 30000
  },
  "prisma:generate": {
    name: "prisma:generate",
    description: "Generate Prisma client",
    command: "npm",
    args: ["run", "prisma:generate"],
    timeoutMs: 30000
  },
  "prisma:migrate:dev": {
    name: "prisma:migrate:dev",
    description: "Create a development migration",
    command: "npm",
    args: ["run", "prisma:migrate:dev"],
    timeoutMs: 60000
  },
  "prisma:migrate:deploy": {
    name: "prisma:migrate:deploy",
    description: "Deploy pending migrations",
    command: "npm",
    args: ["run", "prisma:migrate:deploy"],
    timeoutMs: 60000
  },
  "quality:changed": {
    name: "quality:changed",
    description: "Run quality checks on changed files",
    command: "npm",
    args: ["run", "quality:changed"],
    timeoutMs: 180000
  },
  "lint:fix": {
    name: "lint:fix",
    description: "Run ESLint with auto-fix",
    command: "npm",
    args: ["run", "lint:fix"],
    timeoutMs: 60000
  },
  "stylelint": {
    name: "stylelint",
    description: "Run Stylelint",
    command: "npm",
    args: ["run", "stylelint"],
    timeoutMs: 60000
  },
  "stylelint:fix": {
    name: "stylelint:fix",
    description: "Run Stylelint with auto-fix",
    command: "npm",
    args: ["run", "stylelint:fix"],
    timeoutMs: 60000
  }
};

export function getScriptOrCommand(
  scriptNameOrCommand: string,
  customArgs?: string[]
): { command: string; args: string[] } {
  const script = SCRIPT_REGISTRY[scriptNameOrCommand];

  if (script) {
    return {
      command: script.command,
      args: customArgs ?? script.args ?? []
    };
  }

  // If not in registry, treat as raw command
  return {
    command: scriptNameOrCommand,
    args: customArgs ?? []
  };
}

export function getScriptTimeoutMs(scriptName: string): number {
  return SCRIPT_REGISTRY[scriptName]?.timeoutMs ?? 30000;
}
