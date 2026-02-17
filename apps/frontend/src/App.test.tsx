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
  ],
  auditRecords: Array<Record<string, unknown>> = [
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
        records: auditRecords
      });
    }

    if (url === "/api/tasks" && method === "GET") {
      return mockJsonResponse({
        records: taskStore
      });
    }

    if (url === "/api/workflow/status-model" && method === "GET") {
      return mockJsonResponse({
        statuses: [
          {
            status: "backlog",
            label: "Backlog",
            allowedTransitions: ["planning", "implementing", "done", "cancelled"],
            blockedTransitions: [],
            hookSummary: { onEnterCount: 0, onExitCount: 0 }
          },
          {
            status: "implementing",
            label: "Implementing",
            allowedTransitions: ["backlog", "review", "awaiting_human", "cancelled"],
            blockedTransitions: [
              {
                status: "review",
                reasonCodes: ["MISSING_REVIEW_ARTIFACTS"]
              }
            ],
            hookSummary: { onEnterCount: 1, onExitCount: 2 }
          },
          {
            status: "awaiting_human",
            label: "Awaiting Human",
            allowedTransitions: ["planning", "implementing", "review", "cancelled"],
            blockedTransitions: [],
            hookSummary: { onEnterCount: 0, onExitCount: 0 }
          }
        ]
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

  test("filters kanban cards by selected tag", async () => {
    installFetchMock([
      {
        id: "t-tag-backend",
        title: "Backend only task",
        description: "Backend tag",
        priority: 4,
        status: "backlog",
        dependencies: [],
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        dueAt: null,
        tags: ["backend"],
        metadata: {}
      },
      {
        id: "t-tag-frontend",
        title: "Frontend only task",
        description: "Frontend tag",
        priority: 3,
        status: "backlog",
        dependencies: [],
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        dueAt: null,
        tags: ["frontend"],
        metadata: {}
      }
    ]);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /kanban board/i }));

    await waitFor(() => {
      expect(screen.getByText(/backend only task/i)).toBeInTheDocument();
      expect(screen.getByText(/frontend only task/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/filter by tag/i), {
      target: { value: "backend" }
    });

    await waitFor(() => {
      expect(screen.getByText(/backend only task/i)).toBeInTheDocument();
      expect(screen.queryByText(/frontend only task/i)).not.toBeInTheDocument();
    });
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
          researchReferences: [
            "https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository"
          ],
          workflow: {
            branchName: "task/t-00042-example",
            repository: "csmathguy/haze.ai",
            pullRequestNumber: "27",
            pullRequestUrl: "https://github.com/csmathguy/haze.ai/pull/27"
          },
          planningArtifact: {
            goals: ["Show detailed panel"],
            steps: ["Render planning section"]
          },
          testingArtifacts: {
            schemaVersion: "1.0",
            planned: {
              gherkinScenarios: ["Given X, When Y, Then Z"],
              unitTestIntent: ["Cover scenario edge case"],
              integrationTestIntent: ["Validate end-to-end transition behavior"],
              notes: "Initial planning draft"
            },
            implemented: {
              testsAddedOrUpdated: ["apps/frontend/src/App.test.tsx"],
              evidenceLinks: ["https://example.com/test-run/123"],
              commandsRun: ["npm run test --workspace apps/frontend -- App.test.tsx"],
              notes: "Implemented and validated"
            }
          },
          acceptanceCriteria: [
            "Task detail panel shows acceptance criteria",
            "Task detail panel surfaces timeline metadata"
          ],
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
      expect(
        screen.getByRole("heading", { level: 6, name: /awaiting human review/i })
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/^task details$/i)).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: /acceptance criteria/i })).toBeInTheDocument();
    expect(screen.getByText(/task detail panel shows acceptance criteria/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /timeline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByText(/created/i)).toBeInTheDocument();
    expect(screen.getByText(/updated/i)).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.getByText(/branch:/i)).toBeInTheDocument();
    expect(screen.getByText(/task\/t-00042-example/i)).toBeInTheDocument();
    expect(screen.getByText(/repository:/i)).toBeInTheDocument();
    expect(screen.getByText("csmathguy/haze.ai")).toBeInTheDocument();
    expect(screen.getByText(/pull request:/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /github.com\/csmathguy\/haze.ai\/pull\/27/i })
    ).toHaveAttribute(
      "href",
      "https://github.com/csmathguy/haze.ai/pull/27"
    );
    fireEvent.click(screen.getByRole("button", { name: /plan/i }));
    expect(screen.getByText(/show detailed panel/i)).toBeInTheDocument();
    expect(screen.getByText(/render planning section/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /testing traceability/i }));
    expect(screen.getByText(/given x, when y, then z/i)).toBeInTheDocument();
    expect(screen.getByText(/apps\/frontend\/src\/app\.test\.tsx/i)).toBeInTheDocument();
    expect(screen.getByText(/planned items/i)).toBeInTheDocument();
    expect(screen.getByText(/implemented evidence/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /questionnaire/i }));
    expect(screen.getByText(/which deployment window should we use/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /answer thread/i }));
    expect(screen.getByText(/use later window/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /references/i }));
    expect(screen.getByText(/references \(1\)/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /docs\.github\.com\/en\/communities\/using-templates-to-encourage-useful-issues-and-pull-requests\/creating-a-pull-request-template-for-your-repository/i
      })
    ).toHaveAttribute(
      "href",
      "https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository"
    );
  });

  test("opens status details from lane header and from task status pill", async () => {
    installFetchMock(
      [
        {
          id: "t-status",
          title: "Implementing status task",
          description: "Used for status details flow",
          priority: 3,
          status: "implementing",
          dependencies: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          dueAt: null,
          tags: ["workflow"],
          metadata: {
            workflowRuntime: {
              actionHistory: [
                { status: "implementing", phase: "onEnter" },
                { status: "implementing", phase: "onExit" }
              ]
            }
          }
        }
      ],
      [
        {
          id: "a-task",
          timestamp: new Date().toISOString(),
          eventType: "task_action_executed",
          actor: "task_workflow",
          traceId: "trace-1",
          requestId: "request-1",
          userId: null,
          previousHash: null,
          hash: "hash-task",
          payload: { taskId: "t-status" }
        }
      ]
    );

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /kanban board/i }));

    await waitFor(() => {
      expect(screen.getByText(/implementing status task/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open status details for implementing/i }));
    await waitFor(() => {
      expect(screen.getByText(/status details: implementing/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/missing_review_artifacts/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close status details/i }));
    fireEvent.click(screen.getByRole("button", { name: /implementing status task/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 6, name: /implementing status task/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("selected-task-status-pill"));
    await waitFor(() => {
      expect(screen.getByText(/showing events for task/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/task_action_executed/i)).toBeInTheDocument();
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
      expect(
        screen.getByRole("heading", { level: 6, name: /needs human update/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
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
      expect(screen.getByText(/task dependencies/i)).toBeInTheDocument();
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
