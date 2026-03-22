import { startTransition, useState } from "react";
import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { createPlanningWorkItemFromCodeReview } from "./planning-api.js";
import { buildFollowUpWorkItemDraft } from "./follow-up-work-item.js";
import type { ReviewNotebook, ReviewNotebookEntry } from "./walkthrough.js";

export type FollowUpActionTone = "error" | "info" | "success";

export function useFollowUpAction(
  pullRequest: CodeReviewPullRequestDetail,
  notebook: ReviewNotebook,
  setNotebook: (updater: (currentNotebook: ReviewNotebook) => ReviewNotebook) => void
) {
  const [followUpActionMessage, setFollowUpActionMessage] = useState<string | null>(null);
  const [followUpActionTone, setFollowUpActionTone] = useState<FollowUpActionTone>("info");
  const [isCreatingFollowUp, setIsCreatingFollowUp] = useState(false);

  async function handleCreateFollowUp(): Promise<void> {
    const draft = buildFollowUpWorkItemDraft(pullRequest, notebook.validation);

    if (draft === null) {
      setFollowUpActionTone("info");
      setFollowUpActionMessage("Add at least one follow-up candidate in the final stage before creating a planning item.");
      return;
    }

    setIsCreatingFollowUp(true);
    setFollowUpActionMessage(null);

    try {
      const workItem = await createPlanningWorkItemFromCodeReview(draft);
      startTransition(() => {
        setFollowUpActionTone("success");
        setFollowUpActionMessage(`${workItem.id} created in planning from this review.`);
        setNotebook((currentNotebook) => ({
          ...currentNotebook,
          validation: clearValidationFollowUps(currentNotebook.validation)
        }));
      });
    } catch (error) {
      setFollowUpActionTone("error");
      setFollowUpActionMessage(error instanceof Error ? error.message : "Failed to create follow-up work item.");
    } finally {
      setIsCreatingFollowUp(false);
    }
  }

  function resetFollowUpAction(): void {
    setFollowUpActionMessage(null);
  }

  return {
    followUpActionMessage,
    followUpActionTone,
    handleCreateFollowUp,
    isCreatingFollowUp,
    resetFollowUpAction
  };
}

function clearValidationFollowUps(entry: ReviewNotebookEntry): ReviewNotebookEntry {
  return {
    ...entry,
    followUps: ""
  };
}
