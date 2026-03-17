import * as path from "node:path";

export interface TaxesRuntimeConfig {
  apiHost: string;
  apiPort: number;
  databaseUrl: string;
  webAllowedOrigins: string[];
  webPort: number;
  workspaceDataRoot: string;
}

const DEFAULT_API_HOST = "127.0.0.1";
const DEFAULT_API_PORT = 3040;
const DEFAULT_DATABASE_URL = "file:./data/sqlite/taxes.db";
const DEFAULT_WEB_PORT = 5173;
const DEFAULT_WORKSPACE_DATA_ROOT = path.resolve("data", "workspace");

export const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024;

export function buildRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): TaxesRuntimeConfig {
  const apiHost = environment.TAXES_API_HOST ?? DEFAULT_API_HOST;
  const apiPort = parsePort("TAXES_API_PORT", environment.TAXES_API_PORT, DEFAULT_API_PORT);
  const webPort = parsePort("TAXES_WEB_PORT", environment.TAXES_WEB_PORT, DEFAULT_WEB_PORT);
  const webAllowedOrigins = parseWebOrigins(environment.TAXES_WEB_ORIGINS, webPort);

  return {
    apiHost,
    apiPort,
    databaseUrl: environment.DATABASE_URL ?? environment.TAXES_DATABASE_URL ?? DEFAULT_DATABASE_URL,
    webAllowedOrigins,
    webPort,
    workspaceDataRoot: path.resolve(environment.TAXES_WORKSPACE_DATA_ROOT ?? DEFAULT_WORKSPACE_DATA_ROOT)
  };
}

const runtimeConfig = buildRuntimeConfig();

export const API_HOST = runtimeConfig.apiHost;
export const API_PORT = runtimeConfig.apiPort;
export const DATABASE_URL = runtimeConfig.databaseUrl;
export const WEB_ALLOWED_ORIGINS = runtimeConfig.webAllowedOrigins;
export const WEB_PORT = runtimeConfig.webPort;
export const WORKSPACE_DATA_ROOT = runtimeConfig.workspaceDataRoot;

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

function parseWebOrigins(rawValue: string | undefined, webPort: number): string[] {
  if (rawValue === undefined) {
    return [`http://127.0.0.1:${webPort.toString()}`, `http://localhost:${webPort.toString()}`];
  }

  const entries = rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return entries.length === 0 ? [`http://127.0.0.1:${webPort.toString()}`, `http://localhost:${webPort.toString()}`] : entries;
}
