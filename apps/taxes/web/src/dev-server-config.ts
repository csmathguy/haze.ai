export interface TaxesWebDevServerConfig {
  apiOrigin: string;
  webPort: number;
}

const DEFAULT_API_HOST = "127.0.0.1";
const DEFAULT_API_PORT = 3040;
const DEFAULT_WEB_PORT = 5173;

export function resolveTaxesWebDevServerConfig(environment: NodeJS.ProcessEnv = process.env): TaxesWebDevServerConfig {
  const apiHost = environment.TAXES_API_HOST ?? DEFAULT_API_HOST;
  const apiPort = parsePort("TAXES_API_PORT", environment.TAXES_API_PORT, DEFAULT_API_PORT);
  const webPort = parsePort("TAXES_WEB_PORT", environment.TAXES_WEB_PORT, DEFAULT_WEB_PORT);
  const apiOrigin = environment.TAXES_API_ORIGIN ?? `http://${apiHost}:${apiPort.toString()}`;

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
