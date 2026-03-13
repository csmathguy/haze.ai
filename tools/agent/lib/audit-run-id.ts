import { randomUUID } from "node:crypto";

export function createRunId(workflow: string, now: Date = new Date()): string {
  const stamp = formatLocalRunTimestamp(now);
  return `${stamp}-${slugify(workflow)}-${randomUUID().slice(0, 8)}`;
}

export function getAuditDateSegment(runId: string): string {
  const matchedDate = /^\d{4}-\d{2}-\d{2}/u.exec(runId)?.[0];
  return matchedDate ?? formatLocalDate(new Date());
}

export function slugify(value: string): string {
  const characters = value.trim().toLowerCase().split("");
  let compact = "";
  let previousWasDash = false;

  for (const character of characters) {
    const isLetter = character >= "a" && character <= "z";
    const isDigit = character >= "0" && character <= "9";

    if (isLetter || isDigit) {
      compact += character;
      previousWasDash = false;
      continue;
    }

    if (!previousWasDash && compact.length > 0) {
      compact += "-";
      previousWasDash = true;
    }
  }

  const normalized = compact.endsWith("-") ? compact.slice(0, -1) : compact;
  return normalized.slice(0, 40) || "workflow";
}

function formatLocalRunTimestamp(value: Date): string {
  return `${formatLocalDate(value)}T${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}-${padMilliseconds(value.getMilliseconds())}`;
}

function formatLocalDate(value: Date): string {
  return `${value.getFullYear().toString()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function padMilliseconds(value: number): string {
  return value.toString().padStart(3, "0");
}
