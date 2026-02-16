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
        records: tasks
      });
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
    expect(screen.getByText(/deps 0/i)).toBeInTheDocument();
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
});
