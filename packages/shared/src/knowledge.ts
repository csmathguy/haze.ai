import { z } from "zod";

export const KnowledgeSubjectKindSchema = z.enum(["human", "technology", "library", "workflow", "project", "concept"]);
export const KnowledgeEntryKindSchema = z.enum([
  "agent-memory",
  "doc-mirror",
  "follow-up",
  "process-note",
  "profile-note",
  "research-report",
  "technical-note"
]);
export const KnowledgeVisibilitySchema = z.enum(["agent", "human", "shared"]);
export const KnowledgeEntryStatusSchema = z.enum(["draft", "active", "review-needed", "archived"]);
export const KnowledgeContentFormatSchema = z.enum(["json", "markdown", "hybrid"]);
export const KnowledgeOriginSchema = z.enum(["manual", "agent", "research-agent", "repo-doc-sync"]);
export const KnowledgeImportanceSchema = z.enum(["critical", "high", "medium", "low"]);
export const KnowledgeFactConfidenceSchema = z.enum(["high", "medium", "low"]);

export const KnowledgeFactSchema = z.object({
  confidence: KnowledgeFactConfidenceSchema,
  key: z.string().min(1),
  label: z.string().min(1),
  source: z.string().min(1).optional(),
  value: z.string().min(1)
});
export const KnowledgeSubjectProfileSchema = z.object({
  aliases: z.array(z.string().min(1)).default([]),
  facts: z.array(KnowledgeFactSchema).default([]),
  goals: z.array(z.string().min(1)).default([]),
  preferences: z.array(z.string().min(1)).default([]),
  recentFocus: z.array(z.string().min(1)).default([]),
  summary: z.string().min(1).optional(),
  workingStyle: z.array(z.string().min(1)).default([])
});
export const KnowledgeContentSectionSchema = z.object({
  body: z.string().min(1).optional(),
  items: z.array(z.string().min(1)).default([]),
  title: z.string().min(1)
});
export const KnowledgeSourceLinkSchema = z.object({
  authority: z.enum(["maintainer-docs", "official-docs", "peer-reviewed", "repo-doc", "user-note"]).optional(),
  title: z.string().min(1),
  url: z.string().min(1)
});
export const KnowledgeEntryContentSchema = z.object({
  abstract: z.string().min(1),
  format: KnowledgeContentFormatSchema,
  json: z.record(z.string(), z.unknown()).optional(),
  markdown: z.string().min(1).optional(),
  sections: z.array(KnowledgeContentSectionSchema).default([]),
  sources: z.array(KnowledgeSourceLinkSchema).default([])
});
export const KnowledgeSubjectSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().min(1),
  isPrimaryHuman: z.boolean(),
  kind: KnowledgeSubjectKindSchema,
  name: z.string().min(1),
  namespace: z.string().min(1),
  profile: KnowledgeSubjectProfileSchema.optional(),
  slug: z.string().min(1),
  summary: z.string().min(1).optional(),
  updatedAt: z.iso.datetime()
});
export const KnowledgeEntrySchema = z.object({
  content: KnowledgeEntryContentSchema,
  createdAt: z.iso.datetime(),
  createdByKind: z.enum(["agent", "human", "system"]),
  createdByName: z.string().min(1).optional(),
  id: z.string().min(1),
  importance: KnowledgeImportanceSchema,
  kind: KnowledgeEntryKindSchema,
  lastReviewedAt: z.iso.datetime().optional(),
  namespace: z.string().min(1),
  origin: KnowledgeOriginSchema,
  slug: z.string().min(1),
  sourceTitle: z.string().min(1).optional(),
  sourceUri: z.string().min(1).optional(),
  status: KnowledgeEntryStatusSchema,
  subjectId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)),
  title: z.string().min(1),
  updatedAt: z.iso.datetime(),
  visibility: KnowledgeVisibilitySchema
});
export const KnowledgeWorkspaceSummarySchema = z.object({
  activeEntries: z.int().nonnegative(),
  followUps: z.int().nonnegative(),
  humanSubjects: z.int().nonnegative(),
  repositoryDocs: z.int().nonnegative(),
  subjects: z.int().nonnegative(),
  totalEntries: z.int().nonnegative()
});
export const KnowledgeWorkspaceSchema = z.object({
  entries: z.array(KnowledgeEntrySchema),
  generatedAt: z.iso.datetime(),
  localOnly: z.literal(true),
  subjects: z.array(KnowledgeSubjectSchema),
  summary: KnowledgeWorkspaceSummarySchema
});
export const CreateKnowledgeSubjectInputSchema = z.object({
  isPrimaryHuman: z.boolean().default(false),
  kind: KnowledgeSubjectKindSchema,
  name: z.string().min(1),
  namespace: z.string().min(1),
  profile: KnowledgeSubjectProfileSchema.optional(),
  slug: z.string().min(1).optional(),
  summary: z.string().min(1).optional()
});
export const UpdateKnowledgeSubjectInputSchema = z
  .object({
    isPrimaryHuman: z.boolean().optional(),
    name: z.string().min(1).optional(),
    namespace: z.string().min(1).optional(),
    profile: KnowledgeSubjectProfileSchema.optional(),
    summary: z.string().min(1).optional().nullable()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Provide at least one field to update."
  });
export const CreateKnowledgeEntryInputSchema = z.object({
  content: KnowledgeEntryContentSchema,
  createdByKind: z.enum(["agent", "human", "system"]).default("human"),
  createdByName: z.string().min(1).optional(),
  importance: KnowledgeImportanceSchema.default("medium"),
  kind: KnowledgeEntryKindSchema,
  namespace: z.string().min(1),
  origin: KnowledgeOriginSchema.default("manual"),
  slug: z.string().min(1).optional(),
  sourceTitle: z.string().min(1).optional(),
  sourceUri: z.string().min(1).optional(),
  status: KnowledgeEntryStatusSchema.default("active"),
  subjectId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
  title: z.string().min(1),
  visibility: KnowledgeVisibilitySchema.default("shared")
});
export const UpdateKnowledgeEntryInputSchema = z
  .object({
    content: KnowledgeEntryContentSchema.optional(),
    importance: KnowledgeImportanceSchema.optional(),
    lastReviewedAt: z.iso.datetime().optional().nullable(),
    namespace: z.string().min(1).optional(),
    sourceTitle: z.string().min(1).optional().nullable(),
    sourceUri: z.string().min(1).optional().nullable(),
    status: KnowledgeEntryStatusSchema.optional(),
    subjectId: z.string().min(1).optional().nullable(),
    tags: z.array(z.string().min(1)).optional(),
    title: z.string().min(1).optional(),
    visibility: KnowledgeVisibilitySchema.optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Provide at least one field to update."
  });

export type CreateKnowledgeEntryDraftInput = z.input<typeof CreateKnowledgeEntryInputSchema>;
export type CreateKnowledgeEntryInput = z.infer<typeof CreateKnowledgeEntryInputSchema>;
export type CreateKnowledgeSubjectDraftInput = z.input<typeof CreateKnowledgeSubjectInputSchema>;
export type CreateKnowledgeSubjectInput = z.infer<typeof CreateKnowledgeSubjectInputSchema>;
export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;
export type KnowledgeEntryContent = z.infer<typeof KnowledgeEntryContentSchema>;
export type KnowledgeEntryKind = z.infer<typeof KnowledgeEntryKindSchema>;
export type KnowledgeEntryStatus = z.infer<typeof KnowledgeEntryStatusSchema>;
export type KnowledgeImportance = z.infer<typeof KnowledgeImportanceSchema>;
export type KnowledgeOrigin = z.infer<typeof KnowledgeOriginSchema>;
export type KnowledgeSubject = z.infer<typeof KnowledgeSubjectSchema>;
export type KnowledgeSubjectKind = z.infer<typeof KnowledgeSubjectKindSchema>;
export type KnowledgeSubjectProfile = z.infer<typeof KnowledgeSubjectProfileSchema>;
export type KnowledgeVisibility = z.infer<typeof KnowledgeVisibilitySchema>;
export type KnowledgeWorkspace = z.infer<typeof KnowledgeWorkspaceSchema>;
export type UpdateKnowledgeEntryInput = z.infer<typeof UpdateKnowledgeEntryInputSchema>;
export type UpdateKnowledgeEntryPatchInput = z.input<typeof UpdateKnowledgeEntryInputSchema>;
export type UpdateKnowledgeSubjectInput = z.infer<typeof UpdateKnowledgeSubjectInputSchema>;
export type UpdateKnowledgeSubjectPatchInput = z.input<typeof UpdateKnowledgeSubjectInputSchema>;
