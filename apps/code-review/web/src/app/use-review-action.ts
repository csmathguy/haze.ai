import { useState } from "react";

import type { CodeReviewReviewAction } from "@taxes/shared";

import { submitCodeReviewAction } from "./api.js";

export type ReviewActionTone = "error" | "info" | "success";

export function useReviewAction(
  pullRequestNumber: number,
  onSubmitted: () => Promise<void>
): {
  readonly actionMessage: string | null;
  readonly actionTone: ReviewActionTone;
  readonly isSubmitting: boolean;
  readonly submitAction: (action: CodeReviewReviewAction) => Promise<void>;
} {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<ReviewActionTone>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAction(action: CodeReviewReviewAction): Promise<void> {
    setIsSubmitting(true);
    setActionMessage(null);

    try {
      await submitCodeReviewAction(pullRequestNumber, action);
      await onSubmitted();
      setActionTone("success");
      setActionMessage(action === "approve" ? "Approval sent to GitHub." : "Request changes sent to GitHub.");
    } catch (error) {
      setActionTone("error");
      setActionMessage(error instanceof Error ? error.message : "Failed to submit the review action.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    actionMessage,
    actionTone,
    isSubmitting,
    submitAction
  };
}
