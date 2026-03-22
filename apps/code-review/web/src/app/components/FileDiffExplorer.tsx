import { useState } from "react";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SplitscreenOutlinedIcon from "@mui/icons-material/SplitscreenOutlined";
import SubjectOutlinedIcon from "@mui/icons-material/SubjectOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import type { ReactNode } from "react";
import type { Theme } from "@mui/material/styles";
import { Alert, Chip, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CodeReviewChangedFile } from "@taxes/shared";
import { buildSplitDiffLines, splitPatch, type DiffViewMode, type SplitDiffLine } from "../diff-presentation.js";

interface FileDiffExplorerProps {
  readonly file: CodeReviewChangedFile | undefined;
}

export function FileDiffExplorer({ file }: FileDiffExplorerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("split");

  if (file === undefined) {
    return <Alert severity="info">Select a file card to inspect its explanation and diff.</Alert>;
  }

  const patchLines = splitPatch(file.patch);
  const splitLines = buildSplitDiffLines(file.patch);

  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Stack spacing={1.75}>
        <Stack spacing={0.75}>
          <Typography variant="subtitle2">Inline Diff Explorer</Typography>
          <Typography variant="h6">{file.path}</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip icon={<CodeOutlinedIcon />} label={file.changeType} size="small" variant="outlined" />
            <Chip label={`+${file.additions.toString()} / -${file.deletions.toString()}`} size="small" variant="outlined" />
            {file.tags.map((tag) => (
              <Chip key={`${file.path}-${tag}`} label={tag} size="small" variant="outlined" />
            ))}
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <InsightBlock icon={<VisibilityOutlinedIcon color="secondary" fontSize="small" />} items={[file.explanation.summary]} title="What Changed" />
          <InsightBlock icon={<ForumOutlinedIcon color="info" fontSize="small" />} items={[file.explanation.rationale]} title="Rationale" />
          <InsightBlock icon={<VisibilityOutlinedIcon color="success" fontSize="small" />} items={file.explanation.reviewFocus} title="Review Focus" />
        </Stack>

        <Stack spacing={1}>
          <Stack alignItems={{ sm: "center", xs: "flex-start" }} direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1}>
            <Typography variant="subtitle2">Patch</Typography>
            <ToggleButtonGroup
              color="secondary"
              exclusive
              onChange={(_event, nextMode: DiffViewMode | null) => {
                if (nextMode !== null) {
                  setViewMode(nextMode);
                }
              }}
              size="small"
              value={viewMode}
            >
              <ToggleButton value="split">
                <SplitscreenOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
                Side by side
              </ToggleButton>
              <ToggleButton value="unified">
                <SubjectOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
                Unified
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {patchLines.length === 0 ? (
            <Alert severity="info">GitHub did not return patch text for this file. Open the file on GitHub for the raw diff.</Alert>
          ) : (
            <PatchSurface filePath={file.path} patchLines={patchLines} splitLines={splitLines} viewMode={viewMode} />
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
            p: 1
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

function PatchSurface({
  filePath,
  patchLines,
  splitLines,
  viewMode
}: {
  readonly filePath: string;
  readonly patchLines: ReturnType<typeof splitPatch>;
  readonly splitLines: SplitDiffLine[];
  readonly viewMode: DiffViewMode;
}) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.primary.main, 0.03),
        borderColor: alpha(theme.palette.primary.main, 0.12),
        maxHeight: 460,
        overflow: "auto",
        p: 1.25
      })}
      variant="outlined"
    >
      {viewMode === "unified" ? (
        <Stack spacing={0.25}>
          {patchLines.map((line, index) => (
            <Typography
              color={line.color}
              key={`${filePath}-${index.toString()}`}
              sx={{ fontFamily: "var(--mui-fontFamily-monospace, inherit)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              variant="body2"
            >
              {line.value}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Stack spacing={0.25}>
          {splitLines.map((line, index) => (
            <SplitPatchRow key={`${filePath}-split-${index.toString()}`} line={line} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function SplitPatchRow({ line }: { readonly line: SplitDiffLine }) {
  return (
    <Stack direction="row" spacing={1}>
      <PatchCell kind={line.leftKind} value={line.left} />
      <PatchCell kind={line.rightKind} value={line.right} />
    </Stack>
  );
}

function PatchCell({
  kind,
  value
}: {
  readonly kind: SplitDiffLine["leftKind"] | SplitDiffLine["rightKind"];
  readonly value: string | undefined;
}) {
  return (
    <Typography
      color={resolveCellColor(kind)}
      sx={(theme) => ({
        backgroundColor: resolveCellBackground(theme, kind),
        borderRadius: 1,
        flex: 1,
        fontFamily: "var(--mui-fontFamily-monospace, inherit)",
        minHeight: 22,
        px: 1,
        py: 0.25,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      })}
      variant="body2"
    >
      {value ?? " "}
    </Typography>
  );
}

function resolveCellColor(kind: SplitDiffLine["leftKind"] | SplitDiffLine["rightKind"]) {
  if (kind === "hunk") {
    return "info.main";
  }

  if (kind === "delete") {
    return "error.main";
  }

  if (kind === "add") {
    return "success.main";
  }

  return "text.primary";
}

function resolveCellBackground(theme: Theme, kind: SplitDiffLine["leftKind"] | SplitDiffLine["rightKind"]) {
  if (kind === "delete") {
    return alpha(theme.palette.error.main, 0.08);
  }

  if (kind === "add") {
    return alpha(theme.palette.success.main, 0.08);
  }

  if (kind === "hunk") {
    return alpha(theme.palette.info.main, 0.08);
  }

  return alpha(theme.palette.background.paper, 0.48);
}
