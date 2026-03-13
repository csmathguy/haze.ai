import { z } from "zod";

export const ReviewLaneIdSchema = z.enum(["context", "implementation", "risks", "tests", "validation"]);
export const ReviewLaneSchema = z.object({
  evidence: z.array(z.string().min(1)).min(1),
  id: ReviewLaneIdSchema,
  questions: z.array(z.string().min(1)).min(1),
  reviewerGoal: z.string().min(1),
  summary: z.string().min(1),
  title: z.string().min(1)
});
export const ReviewPrincipleSchema = z.object({
  description: z.string().min(1),
  title: z.string().min(1)
});
export const ReviewRoadmapStageSchema = z.enum(["mvp", "next", "later"]);
export const ReviewRoadmapItemSchema = z.object({
  dependencies: z.array(z.string().min(1)),
  id: z.string().min(1),
  outcome: z.string().min(1),
  stage: ReviewRoadmapStageSchema,
  summary: z.string().min(1),
  title: z.string().min(1)
});
export const ResearchSourceAuthoritySchema = z.enum(["official-docs", "peer-reviewed", "industry-practice"]);
export const ResearchSourceSchema = z.object({
  authority: ResearchSourceAuthoritySchema,
  id: z.string().min(1),
  note: z.string().min(1),
  reviewedAt: z.iso.date(),
  title: z.string().min(1),
  url: z.url()
});
export const CodeReviewWorkspaceSchema = z.object({
  freshnessStrategy: z.array(z.string().min(1)).min(1),
  generatedAt: z.iso.datetime(),
  lanes: z.array(ReviewLaneSchema).min(1),
  localOnly: z.literal(true),
  principles: z.array(ReviewPrincipleSchema).min(1),
  purpose: z.string().min(1),
  researchSources: z.array(ResearchSourceSchema).min(1),
  roadmap: z.array(ReviewRoadmapItemSchema).min(1),
  title: z.string().min(1),
  trustStatement: z.string().min(1)
});

export type CodeReviewWorkspace = z.infer<typeof CodeReviewWorkspaceSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type ResearchSourceAuthority = z.infer<typeof ResearchSourceAuthoritySchema>;
export type ReviewLane = z.infer<typeof ReviewLaneSchema>;
export type ReviewLaneId = z.infer<typeof ReviewLaneIdSchema>;
export type ReviewPrinciple = z.infer<typeof ReviewPrincipleSchema>;
export type ReviewRoadmapItem = z.infer<typeof ReviewRoadmapItemSchema>;
export type ReviewRoadmapStage = z.infer<typeof ReviewRoadmapStageSchema>;
