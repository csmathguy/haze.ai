import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { afterEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";
import { appTheme } from "./theme";

function mockJsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  } as Response;
}

function renderApp() {
  return render(
    <ThemeProvider theme={appTheme} defaultMode="light">
      <CssBaseline enableColorScheme />
      <App />
    </ThemeProvider>
  );
}

function installFetchMock(
  tasks: Array<Record<string, unknown>> = [
    {
      id: "t1",
      title: "Implement queue",
      description: "Create queue worker",
      priority: 5,
      status: "backlog",
      dependencies: [],
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z",
      startedAt: null,
      completedAt: null,
      dueAt: null,
      tags: ["backend"],
      metadata: {}
    }
  ]
) {
  const taskStore = tasks.map((task) => ({ ...task })) as Array<Record<string, unknown>>;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/orchestrator/status" && method === "GET") {
      return mockJsonResponse({ busy: false, lastWakeReason: "startup" });
    }

    if (url.startsWith("/api/audit/recent") && method === "GET") {
      return mockJsonResponse({
        records: [
          {
            id: "a1",
            timestamp: new Date().toISOString(),
            eventType: "backend_started",
            actor: "system",
            traceId: "trace-1",
            requestId: "request-1",
            userId: null,
            previousHash: null,
            hash: "hash-1",
            payload: {}
          }
        ]
      });
    }

    if (url === "/api/tasks" && method === "GET") {
      return mockJsonResponse({
        records: taskStore
      });
    }

    if (url.startsWith("/api/tasks/") && method === "PATCH") {
      const taskId = url.split("/").pop();
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        status?: string;
        metadata?: Record<string, unknown>;
      };
      const index = taskStore.findIndex((task) => String(task.id) === taskId);
      if (index === -1) {
        return mockJsonResponse({}, false);
      }
      taskStore[index] = {
        ...taskStore[index],
        status: body.status ?? taskStore[index].status,
        metadata: body.metadata ?? taskStore[index].metadata
      };
      return mockJsonResponse({ record: taskStore[index] });
    }

    if (url === "/api/orchestrator/wake" && method === "POST") {
      return mockJsonResponse({ accepted: true });
    }

    if (url === "/api/heartbeat/pulse" && method === "POST") {
      return mockJsonResponse({ accepted: true });
    }

    return mockJsonResponse({}, false);
  });
}

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  test("renders dashboard by default with audit events", async () => {
    installFetchMock();

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/orchestrator status/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/live audit feed/i)).toBeInTheDocument();
    expect(screen.getByText(/backend_started/i)).toBeInTheDocument();
  });

  test("navigates to kanban board and loads task cards", async () => {
    const fetchMock = installFetchMock();

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /kanban board/i }));

    await waitFor(() => {
      expect(screen.getByText(/real-time workflow board/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/implement queue/i)).toBeInTheDocument();
    });
    expect(screen.getByText("P5")).toBeInTheDocument();
    expect(screen.getByLabelText(/dependencies: 0/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dependents: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/id t1/i)).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks");
  });

  test("wakes orchestrator from dashboard action", async () => {
    const fetchMock = installFetchMock();

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/orchestrator status/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /wake orchestrator/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/orchestrator/wake",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  test("keeps kanban view on refresh via URL state", async () => {
    installFetchMock();
    window.history.replaceState({}, "", "/?view=kanban");

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/real-time workflow board/i)).toBeInTheDocument();
    });
  });

  test("updates URL when navigating to kanban", async () => {
    installFetchMock();

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /kanban board/i }));

    await waitFor(() => {
      expect(window.location.search).toContain("view=kanban");
    });
  });

  test("opens task detail panel with plan, questionnaire, and answer thread", async () => {
    installFetchMock([
      {
        id: "t2",
        title: "Awaiting human review",
        description: "Need a decision to proceed",
        priority: 4,
        status: "awaiting_human",
        dependencies: [],
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        dueAt: null,
        tags: ["workflow"],
        metadata: {
          canonicalTaskId: "T-00042",
          workflow: {
            branchName: "task/t-00042-example"
          },
          planningArtifact: {
            goals: ["Show detailed panel"],
            implementationSteps: ["Render planning section"]
          },
          awaitingHumanArtifact: {
            question: "Which deployment window should we use?",
            options: ["Now", "Later"],
            recommendedDefault: "Later",
            blockingReason: "Need operator approval"
          },
          answerThread: [
            {
              actor: "human",
              answer: "Use later window",
              timestamp: "2026-02-16T12:00:00.000Z"
            }
          ]
        }
      }
    ]);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /kanban board/i }));

    await waitFor(() => {
      expect(screen.getByText(/awaiting human review/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /awaiting human review/i }));

    await waitFor(() => {
      expect(screen.getByText(/task details/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/id: t-00042/i)).toBeInTheDocument();
    expect(screen.getByText(/branch: task\/t-00042-example/i)).toBeInTheDocument();
    expect(screen.getByText(/show detailed panel/i)).toBeInTheDocument();
    expect(screen.getByText(/which deployment window should we use/i)).toBeInTheDocument();
    expect(screen.getByText(/use later window/i)).toBeInTheDocument();
  });

  test("allows human to update task status from detail drawer", async () => {
    const fetchMock = installFetchMock([
      {
        id: "t3",
        title: "Needs human update",
        description: "Move status after human review",
        priority: 3,
        status: "awaiting_human",
        dependencies: [],
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        dueAt: null,
        tags: ["workflow"],
        metadata: {}
      }
    ]);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /kanban board/i }));

    await waitFor(() => {
      expect(screen.getByText(/needs human update/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /needs human update/i }));

    await waitFor(() => {
      expect(screen.getByText(/task details/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/update status/i), {
      target: { value: "backlog" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save status change/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tasks/t3",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  test("renders lane-level scroll containers with minimum height", async () => {
    installFetchMock([
      {
        id: "t4",
        title: "Dense lane item",
        description: "Testing lane container layout",
        priority: 2,
        status: "backlog",
        dependencies: [],
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        dueAt: null,
        tags: ["layout"],
        metadata: {}
      }
    ]);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /kanban board/i }));

    const laneScroll = await screen.findByTestId("lane-scroll-backlog");
    expect(laneScroll).toHaveAttribute("data-lane-scroll", "true");
    expect(laneScroll).toHaveStyle({
      height: "520px",
      minHeight: "360px",
      overflowY: "scroll"
    });

    const card = screen.getByText(/dense lane item/i).closest(".MuiCard-root");
    expect(card).toBeTruthy();
    expect(card).toHaveAttribute("data-card-fixed", "true");
    expect(card).toHaveStyle({ height: "196px" });
  });

  test("shows dependency links in task details and supports related-task back navigation", async () => {
    installFetchMock([
      {
        id: "parent-1",
        title: "Parent dependency task",
        description: "Must complete before child",
        priority: 4,
        status: "backlog",
        dependencies: [],
        dependents: ["child-1"],
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        dueAt: null,
        tags: ["workflow"],
        metadata: {}
      },
      {
        id: "child-1",
        title: "Child blocked task",
        description: "Blocked until parent is done",
        priority: 3,
        status: "backlog",
        dependencies: ["parent-1"],
        dependents: [],
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        dueAt: null,
        tags: ["workflow"],
        metadata: {}
      }
    ]);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /kanban board/i }));

    await waitFor(() => {
      expect(screen.getByText(/child blocked task/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/blocked by dependencies/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /child blocked task/i }));
    await waitFor(() => {
      expect(screen.getByText(/task links/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/blocked by dependencies/i)).toBeInTheDocument();
    expect(screen.getByText(/dependencies \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/dependents \(0\)/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /open related task parent-1 - parent dependency task/i
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 6, name: /parent dependency task/i })
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/dependents \(1\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/back to previous task/i));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 6, name: /child blocked task/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/dependencies \(1\)/i)).toBeInTheDocument();
    });
  });
});
