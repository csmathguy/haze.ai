const CANONICAL_TASK_ID_PATTERN = /^T-\d{5}$/;

function slugifyTitle(value) {
  const raw = typeof value === "string" ? value : "";
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug.length > 0 ? slug : "task";
}

function resolveBranchId(taskId, canonicalTaskId) {
  if (
    typeof canonicalTaskId === "string" &&
    CANONICAL_TASK_ID_PATTERN.test(canonicalTaskId.trim())
  ) {
    return canonicalTaskId.toLowerCase();
  }

  if (typeof taskId !== "string" || taskId.trim().length === 0) {
    throw new Error("taskId is required");
  }

  return taskId.toLowerCase();
}

export function resolveTaskBranchName({ taskId, canonicalTaskId, title }) {
  const branchId = resolveBranchId(taskId, canonicalTaskId);
  const titleSlug = slugifyTitle(title);
  return `task/${branchId}-${titleSlug}`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) {
      continue;
    }
    const normalizedKey = key.slice(2);
    args[normalizedKey] = value;
    i += 1;
  }
  return args;
}

if (process.argv[1] && process.argv[1].endsWith("resolve-task-branch-name.mjs")) {
  const args = parseArgs(process.argv.slice(2));
  const branchName = resolveTaskBranchName({
    taskId: args["task-id"],
    canonicalTaskId: args["canonical-task-id"],
    title: args.title
  });
  process.stdout.write(branchName);
}
