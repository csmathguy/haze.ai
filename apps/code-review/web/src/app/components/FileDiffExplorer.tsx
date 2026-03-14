import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import type { ReactNode } from "react";
import { Alert, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CodeReviewChangedFile } from "@taxes/shared";

interface FileDiffExplorerProps {
  readonly file: CodeReviewChangedFile | undefined;
}

export function FileDiffExplorer({ file }: FileDiffExplorerProps) {
  if (file === undefined) {
    return <Alert severity="info">Select a file card to inspect its explanation and diff.</Alert>;
  }

  const patchLines = splitPatch(file.patch);

  return (
    <Paper sx={{ p: 2.75 }} variant="outlined">
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Inline Diff Explorer</Typography>
          <Typography variant="h3">{file.path}</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip icon={<CodeOutlinedIcon />} label={file.changeType} size="small" variant="outlined" />
            <Chip label={`+${file.additions.toString()} / -${file.deletions.toString()}`} size="small" variant="outlined" />
            {file.tags.map((tag) => (
              <Chip key={`${file.path}-${tag}`} label={tag} size="small" variant="outlined" />
            ))}
          </Stack>
        </Stack>

        <Stack spacing={1.5}>
          <InsightBlock icon={<VisibilityOutlinedIcon color="secondary" fontSize="small" />} items={[file.explanation.summary]} title="What Changed" />
          <InsightBlock icon={<ForumOutlinedIcon color="info" fontSize="small" />} items={[file.explanation.rationale]} title="Rationale" />
          <InsightBlock icon={<VisibilityOutlinedIcon color="success" fontSize="small" />} items={file.explanation.reviewFocus} title="Review Focus" />
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Patch</Typography>
          {patchLines.length === 0 ? (
            <Alert severity="info">GitHub did not return patch text for this file. Open the file on GitHub for the raw diff.</Alert>
          ) : (
            <Paper
              sx={(theme) => ({
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                borderColor: alpha(theme.palette.primary.main, 0.14),
                maxHeight: 420,
                overflow: "auto",
                p: 1.5
              })}
              variant="outlined"
            >
              <Stack spacing={0.25}>
                {patchLines.map((line, index) => (
                  <Typography
                    color={line.color}
                    key={`${file.path}-${index.toString()}`}
                    sx={{ fontFamily: "var(--mui-fontFamily-monospace, inherit)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    variant="body2"
                  >
                    {line.value}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function InsightBlock({
  icon,
  items,
  title
}: {
  readonly icon: ReactNode;
  readonly items: string[];
  readonly title: string;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>
      {items.map((item) => (
        <Paper
          key={item}
          sx={(theme) => ({
            alignItems: "flex-start",
            backgroundColor: alpha(theme.palette.background.default, 0.78),
            borderColor: alpha(theme.palette.divider, 0.6),
            display: "flex",
            gap: 1,
            p: 1.25
          })}
          variant="outlined"
        >
          {icon}
          <Typography variant="body2">{item}</Typography>
        </Paper>
      ))}
    </Stack>
  );
}

function splitPatch(patch: string | undefined): { readonly color: "error.main" | "info.main" | "success.main" | "text.primary"; readonly value: string }[] {
  if (patch === undefined || patch.length === 0) {
    return [];
  }

  return patch.split("\n").map((line) => ({
    color: resolvePatchLineColor(line),
    value: line
  }));
}

function resolvePatchLineColor(line: string): "error.main" | "info.main" | "success.main" | "text.primary" {
  if (line.startsWith("@@")) {
    return "info.main";
  }

  if (line.startsWith("+")) {
    return "success.main";
  }

  if (line.startsWith("-")) {
    return "error.main";
  }

  return "text.primary";
}
