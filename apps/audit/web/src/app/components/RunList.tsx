import {
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

import type { AuditRunDetail, AuditRunOverview, AuditWorkItemTimeline } from "@taxes/shared";

import { summarizeRunPresentation } from "../run-presentation.js";
import { formatDateTime, formatDuration, formatRelativePath } from "../time.js";
import { useResizableDrawer } from "../use-resizable-drawer.js";
import { RunDetailDrawer } from "./RunDetailDrawer.js";

interface RunListProps {
  readonly detailError: string | null;
  readonly isLoadingDetail: boolean;
  readonly onSelect: (runId: string | null) => void;
  readonly runs: AuditRunOverview[];
  readonly selectedRunId: string | null;
  readonly detail: AuditRunDetail | null;
  readonly timeline: AuditWorkItemTimeline | null;
}

const DEFAULT_ROWS_PER_PAGE = 25;
const TableShell = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: Number(theme.shape.borderRadius) * 1.15,
  overflow: "hidden"
}));

const TableRowButton = styled(TableRow)(({ theme }) => ({
  cursor: "pointer",
  "&.Mui-selected": {
    backgroundColor: alpha(theme.palette.secondary.main, 0.1)
  },
  "&.Mui-selected:hover": {
    backgroundColor: alpha(theme.palette.secondary.main, 0.16)
  },
  "&:hover": {
    backgroundColor: alpha(theme.palette.secondary.main, 0.06)
  }
}));

export function RunList({ detail, detailError, isLoadingDetail, onSelect, runs, selectedRunId, timeline }: RunListProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const isDrawerOpen = detail !== null;
  const { drawerWidth, startResize } = useResizableDrawer(true);

  useEffect(() => {
    setPage(0);
  }, [runs]);

  const visibleRuns = useMemo(() => runs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [page, rowsPerPage, runs]);

  return (
    <Stack spacing={2}>
      <RunTable
        onSelect={onSelect}
        page={page}
        runs={runs}
        rowsPerPage={rowsPerPage}
        selectedRunId={selectedRunId}
        setPage={setPage}
        setRowsPerPage={setRowsPerPage}
        visibleRuns={visibleRuns}
      />
      <RunDetailDrawer
        detail={detail}
        detailError={detailError}
        drawerWidth={drawerWidth}
        isDrawerOpen={isDrawerOpen}
        isLoadingDetail={isLoadingDetail}
        onClose={() => {
          onSelect(null);
        }}
        onResize={startResize}
        timeline={timeline}
      />
    </Stack>
  );
}

function RunTable({
  onSelect,
  page,
  runs,
  rowsPerPage,
  selectedRunId,
  setPage,
  setRowsPerPage,
  visibleRuns
}: {
  readonly onSelect: (runId: string | null) => void;
  readonly page: number;
  readonly runs: AuditRunOverview[];
  readonly rowsPerPage: number;
  readonly selectedRunId: string | null;
  readonly setPage: (page: number) => void;
  readonly setRowsPerPage: (rowsPerPage: number) => void;
  readonly visibleRuns: AuditRunOverview[];
}) {
  return (
    <TableShell elevation={0}>
      <Stack spacing={0}>
        <RunTableHeader page={page} rowsPerPage={rowsPerPage} runCount={runs.length} />
        <Divider />
        <RunTableGrid
          onSelect={onSelect}
          selectedRunId={selectedRunId}
          setPage={setPage}
          setRowsPerPage={setRowsPerPage}
          visibleRuns={visibleRuns}
          page={page}
          rowsPerPage={rowsPerPage}
          runCount={runs.length}
        />
      </Stack>
    </TableShell>
  );
}

function RunTableHeader({
  page,
  rowsPerPage,
  runCount
}: {
  readonly page: number;
  readonly rowsPerPage: number;
  readonly runCount: number;
}) {
  return (
    <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" px={2.5} py={2} spacing={1}>
      <div>
        <Typography variant="h3">Audit runs</Typography>
        <Typography color="text.secondary" variant="body2">
          Showing the latest {Math.min(rowsPerPage, runCount).toString()} runs per page. Select a row to inspect the drawer.
        </Typography>
      </div>
      <Stack alignItems={{ sm: "flex-end", xs: "flex-start" }} spacing={0.5}>
        <Chip label={`${runCount.toString()} loaded`} variant="outlined" />
        <Typography color="text.secondary" variant="caption">
          Page {page + 1} of {Math.max(1, Math.ceil(runCount / rowsPerPage))}
        </Typography>
      </Stack>
    </Stack>
  );
}

function RunTableGrid({
  onSelect,
  page,
  selectedRunId,
  setPage,
  setRowsPerPage,
  visibleRuns,
  rowsPerPage,
  runCount
}: {
  readonly onSelect: (runId: string | null) => void;
  readonly page: number;
  readonly selectedRunId: string | null;
  readonly setPage: (page: number) => void;
  readonly setRowsPerPage: (rowsPerPage: number) => void;
  readonly visibleRuns: AuditRunOverview[];
  readonly rowsPerPage: number;
  readonly runCount: number;
}) {
  return (
    <>
      <Table size="small" aria-label="Audit runs">
        <TableHead>
          <TableRow>
            <TableCell>Run</TableCell>
            <TableCell>Workflow</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Started</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Worktree</TableCell>
            <TableCell align="right">Signals</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleRuns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Stack minHeight={220} justifyContent="center" spacing={1}>
                  <Typography variant="body1">No runs match the current filters.</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Start a workflow or clear one of the filters above.
                  </Typography>
                </Stack>
              </TableCell>
            </TableRow>
          ) : (
            visibleRuns.map((run) => (
              <RunTableRow key={run.runId} onSelect={onSelect} run={run} selected={run.runId === selectedRunId} />
            ))
          )}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={runCount}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(_, nextPage) => {
          setPage(nextPage);
        }}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
      />
    </>
  );
}

function RunTableRow({
  onSelect,
  run,
  selected
}: {
  readonly onSelect: (runId: string | null) => void;
  readonly run: AuditRunOverview;
  readonly selected: boolean;
}) {
  const presentation = summarizeRunPresentation(run);

  return (
    <TableRowButton
      hover
      onClick={() => {
        onSelect(run.runId);
      }}
      selected={selected}
    >
      <TableCell>
        <Stack spacing={0.3}>
          <Typography variant="body2">{presentation.title}</Typography>
          <Typography color="text.secondary" variant="caption">
            {run.runId}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Stack spacing={0.6}>
          <Chip label={run.workflow} size="small" variant="outlined" />
          <Typography color="text.secondary" variant="caption">
            {run.agentName ?? "No agent"}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Chip color={toChipColor(run.status)} label={run.status} size="small" />
      </TableCell>
      <TableCell>{formatDateTime(run.startedAt)}</TableCell>
      <TableCell>{formatDuration(run.durationMs)}</TableCell>
      <TableCell>{formatRelativePath(run.worktreePath)}</TableCell>
      <TableCell align="right">
        <Stack alignItems="flex-end" spacing={0.5}>
          <Chip label={`${run.executionCount.toString()} exec`} size="small" variant="outlined" />
          <Chip label={`${run.failureCount.toString()} fail`} size="small" variant={run.failureCount > 0 ? "filled" : "outlined"} />
        </Stack>
      </TableCell>
    </TableRowButton>
  );
}

function toChipColor(status: AuditRunOverview["status"]): "default" | "error" | "success" | "warning" {
  switch (status) {
    case "failed":
      return "error";
    case "running":
      return "warning";
    case "skipped":
      return "default";
    case "success":
      return "success";
    default:
      return "default";
  }
}
