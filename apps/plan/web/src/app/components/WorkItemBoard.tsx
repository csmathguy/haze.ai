import { useMemo, useRef, type RefObject } from "react";
import { Box, Button, ButtonBase, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { WorkItem, WorkItemStatus } from "@taxes/shared";

const BOARD_COLUMNS: readonly {
  description: string;
  status: WorkItemStatus;
  title: string;
}[] = [
  { description: "Needs shaping", status: "backlog", title: "Backlog" },
  { description: "In definition", status: "planning", title: "Planning" },
  { description: "Ready to pull", status: "ready", title: "Ready" },
  { description: "Actively moving", status: "in-progress", title: "In progress" },
  { description: "Waiting on a blocker", status: "blocked", title: "Blocked" },
  { description: "Closed out", status: "done", title: "Done" },
  { description: "Hidden from the main flow", status: "archived", title: "Archived" }
] as const;

interface WorkItemBoardProps {
  readonly onSelect: (workItemId: string) => void;
  readonly selectedWorkItemId: string | null;
  readonly workItems: WorkItem[];
}

export function WorkItemBoard({ onSelect, selectedWorkItemId, workItems }: WorkItemBoardProps) {
  const theme = useTheme();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const hasItems = workItems.length > 0;
  const columnSummaries = useMemo(() => buildColumnSummaries(workItems), [workItems]);

  function scrollBoard(direction: "left" | "right"): void {
    const scroller = scrollerRef.current;
    if (scroller === null) {
      return;
    }

    const distance = Math.max(320, Math.round(scroller.clientWidth * 0.72));
    scroller.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -distance : distance
    });
  }

  return (
    <Stack spacing={1.5}>
      <BoardHeader hasItems={hasItems} onScrollBoard={scrollBoard} />
      {hasItems ? (
        <BoardScroller
          columnSummaries={columnSummaries}
          onSelect={onSelect}
          paperBackground={theme.palette.background.paper}
          primaryMain={theme.palette.primary.main}
          scrollerRef={scrollerRef}
          selectedWorkItemId={selectedWorkItemId}
          textPrimary={theme.palette.text.primary}
          workItems={workItems}
        />
      ) : (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary" variant="body2">
            No work items match the current project scope.
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}

function BoardHeader({
  hasItems,
  onScrollBoard
}: {
  readonly hasItems: boolean;
  readonly onScrollBoard: (direction: "left" | "right") => void;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="h2">Kanban board</Typography>
      <Typography color="text.secondary" variant="body2">
        Click any card to open the full brief in a drawer while keeping the board visible underneath.
      </Typography>
      <Stack direction="row" justifyContent="space-between" spacing={1} flexWrap="wrap">
        <Typography color="text.secondary" variant="body2">
          {hasItems
            ? "Use the scroll controls to move across the board, or click a card to open its drawer."
            : "No work items match the current project scope."}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            disabled={!hasItems}
            onClick={() => {
              onScrollBoard("left");
            }}
            size="small"
            variant="outlined"
          >
            Scroll left
          </Button>
          <Button
            disabled={!hasItems}
            onClick={() => {
              onScrollBoard("right");
            }}
            size="small"
            variant="outlined"
          >
            Scroll right
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

function BoardScroller({
  columnSummaries,
  onSelect,
  paperBackground,
  primaryMain,
  scrollerRef,
  selectedWorkItemId,
  textPrimary,
  workItems
}: {
  readonly columnSummaries: ReturnType<typeof buildColumnSummaries>;
  readonly onSelect: (workItemId: string) => void;
  readonly paperBackground: string;
  readonly primaryMain: string;
  readonly scrollerRef: RefObject<HTMLDivElement | null>;
  readonly selectedWorkItemId: string | null;
  readonly textPrimary: string;
  readonly workItems: WorkItem[];
}) {
  return (
    <Box
      ref={scrollerRef}
      sx={{
        overflowX: "auto",
        pb: 1,
        scrollBehavior: "smooth",
        scrollbarGutter: "stable both-edges",
        scrollSnapType: "x proximity"
      }}
    >
      <Stack alignItems="stretch" direction="row" spacing={2} sx={{ minWidth: "max-content" }}>
        {columnSummaries.map((column) => (
          <ColumnLane
            key={column.status}
            column={column}
            onSelect={onSelect}
            paperBackground={paperBackground}
            primaryMain={primaryMain}
            selectedWorkItemId={selectedWorkItemId}
            textPrimary={textPrimary}
            workItems={workItems}
          />
        ))}
      </Stack>
    </Box>
  );
}

function ColumnLane({
  column,
  onSelect,
  paperBackground,
  primaryMain,
  selectedWorkItemId,
  textPrimary,
  workItems
}: {
  readonly column: ReturnType<typeof buildColumnSummaries>[number];
  readonly onSelect: (workItemId: string) => void;
  readonly paperBackground: string;
  readonly primaryMain: string;
  readonly selectedWorkItemId: string | null;
  readonly textPrimary: string;
  readonly workItems: WorkItem[];
}) {
  const columnItems = workItems.filter((workItem) => workItem.status === column.status);

  return (
    <Paper
      sx={{
        backgroundColor: alpha(paperBackground, 0.84),
        minHeight: 360,
        p: 1.5,
        scrollSnapAlign: "start",
        width: { lg: 268, xs: 240 }
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Stack spacing={0.5}>
            <Typography variant="h4">{column.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {column.description}
            </Typography>
          </Stack>
          <Chip label={`${String(column.count)} item${column.count === 1 ? "" : "s"}`} size="small" />
        </Stack>
        <Stack spacing={1.5}>
          {columnItems.length === 0 ? (
            <EmptyColumnState title={column.title} />
          ) : (
            columnItems.map((workItem) => (
              <WorkItemBoardCard
                key={workItem.id}
                onSelect={onSelect}
                paperBackground={paperBackground}
                primaryMain={primaryMain}
                selected={selectedWorkItemId === workItem.id}
                textPrimary={textPrimary}
                workItem={workItem}
              />
            ))
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function buildColumnSummaries(workItems: WorkItem[]) {
  return BOARD_COLUMNS.map((column) => ({
    ...column,
    count: workItems.filter((workItem) => workItem.status === column.status).length
  }));
}

function WorkItemBoardCard({
  onSelect,
  paperBackground,
  primaryMain,
  selected,
  textPrimary,
  workItem
}: {
  readonly onSelect: (workItemId: string) => void;
  readonly paperBackground: string;
  readonly primaryMain: string;
  readonly selected: boolean;
  readonly textPrimary: string;
  readonly workItem: WorkItem;
}) {
  return (
    <ButtonBase
      focusRipple
      onClick={() => {
        onSelect(workItem.id);
      }}
      sx={{
        ...boardCardBaseSx,
        backgroundColor: selected ? alpha(primaryMain, 0.12) : paperBackground,
        borderColor: selected ? primaryMain : alpha(textPrimary, 0.08),
        boxShadow: selected
          ? `0 20px 44px -34px ${alpha(primaryMain, 0.6)}`
          : `0 18px 36px -34px ${alpha(textPrimary, 0.5)}`,
        "&:hover": {
          borderColor: alpha(primaryMain, 0.4),
          boxShadow: `0 22px 40px -32px ${alpha(primaryMain, 0.55)}`,
          transform: "translateY(-1px)"
        }
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="caption">{workItem.id}</Typography>
          <Chip label={renderTaskProgress(workItem)} size="small" />
        </Stack>
        <Typography sx={cardTitleSx} variant="h3">
          {workItem.title}
        </Typography>
        <Typography color="text.secondary" sx={cardSummarySx} variant="body2">
          {workItem.summary}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip color="primary" label={workItem.projectKey} size="small" />
          <Chip label={workItem.kind} size="small" />
          <Chip label={workItem.priority} size="small" />
        </Stack>
      </Stack>
    </ButtonBase>
  );
}

function EmptyColumnState({ title }: { readonly title: string }) {
  return (
    <Paper
      sx={{
        borderRadius: "20px",
        p: 2
      }}
    >
      <Typography color="text.secondary" variant="body2">
        No items in {title.toLowerCase()}.
      </Typography>
    </Paper>
  );
}

function renderTaskProgress(workItem: WorkItem): string {
  const completedTasks = workItem.tasks.filter((task) => task.status === "done").length;
  return `${String(completedTasks)}/${String(workItem.tasks.length)} tasks`;
}

const boardCardBaseSx = {
  alignItems: "flex-start",
  borderRadius: "20px",
  borderStyle: "solid",
  borderWidth: 1,
  cursor: "pointer",
  display: "block",
  overflow: "hidden",
  padding: "14px",
  textAlign: "left",
  transition: "transform 120ms ease, border-color 120ms ease, background-color 120ms ease",
  width: "100%"
} as const;

const cardTitleSx = {
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3
} as const;

const cardSummarySx = {
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3
} as const;
