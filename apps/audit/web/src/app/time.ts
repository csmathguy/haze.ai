export function formatDateTime(value: string | undefined): string {
  if (value === undefined) {
    return "Not finished";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

export function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) {
    return "Running";
  }

  if (durationMs < 1000) {
    return `${durationMs.toString()} ms`;
  }

  const seconds = durationMs / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes.toString()}m ${remainingSeconds.toString()}s`;
}

export function formatRelativePath(fullPath: string | undefined): string {
  if (fullPath === undefined) {
    return "Unknown path";
  }

  const segments = fullPath.split(/[\\/]/u).filter((segment) => segment.length > 0);

  if (segments.length <= 2) {
    return fullPath;
  }

  return segments.slice(-2).join("\\");
}
