/**
 * Interpolates {{input.workItemId}} style context variables into a string value.
 * Supports dot-notation paths within contextJson.
 */
// eslint-disable-next-line sonarjs/slow-regex
const TEMPLATE_RE = /\{\{([^}]+)\}\}/g;

export function interpolateContextVar(template: string, contextJson: Record<string, unknown>): string {
  return template.replace(TEMPLATE_RE, (_match, path: string) => {
    const parts = path.trim().split(".");
    let current: unknown = contextJson;
    for (const part of parts) {
      if (current !== null && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return _match; // leave unresolved placeholders as-is
      }
    }
    if (typeof current === "string") return current;
    if (current === null || current === undefined) return "";
    return typeof current === "object" ? JSON.stringify(current) : (current as number | boolean | bigint).toString();
  });
}

/** Interpolates all string args in a command step's args array. */
export function interpolateArgs(args: string[] | undefined, contextJson: Record<string, unknown>): string[] {
  return (args ?? []).map((arg) => interpolateContextVar(arg, contextJson));
}
