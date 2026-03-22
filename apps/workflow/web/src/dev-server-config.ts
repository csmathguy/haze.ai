export interface WorkflowWebDevServerConfig {
  apiOrigin: string;
  webPort: number;
}

const DEFAULT_API_HOST = "127.0.0.1";
const DEFAULT_API_PORT = 3181;
const DEFAULT_WEB_PORT = 5179;

export function resolveWorkflowWebDevServerConfig(environment: NodeJS.ProcessEnv = process.env): WorkflowWebDevServerConfig {
  const apiHost = environment.WORKFLOW_API_HOST ?? DEFAULT_API_HOST;
  const apiPort = parsePort("WORKFLOW_API_PORT", environment.WORKFLOW_API_PORT, DEFAULT_API_PORT);
  const webPort = parsePort("WORKFLOW_WEB_PORT", environment.WORKFLOW_WEB_PORT, DEFAULT_WEB_PORT);
  const apiOrigin = environment.WORKFLOW_API_ORIGIN ?? `http://${apiHost}:${apiPort.toString()}`;

  return {
    apiOrigin,
    webPort
  };
}

function parsePort(flagName: string, rawValue: string | undefined, fallback: number): number {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid ${flagName}: ${rawValue}`);
  }

  return parsed;
}
