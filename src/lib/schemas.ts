/**
 * Zod validation schemas for all model outputs and structured objects in Clauseora.
 * Used for strict fail-closed validation of LLM output.
 */

import { z } from "zod";

// ─── Simplify ─────────────────────────────────────────────────────────────────

export const clauseItemSchema = z.object({
  kind: z.enum(["obligation", "deadline", "money", "condition", "review_flag"]),
  party: z.string(),
  statement: z.string(),
  anchorIds: z.array(z.string()).min(1),
});

export const definedTermSchema = z.object({
  term: z.string(),
  meaningInContext: z.string(),
  anchorIds: z.array(z.string()).optional(),
});

export const clauseCardSchema = z.object({
  topic: z.string(),
  plainLanguage: z.string(),
  definedTerms: z.array(definedTermSchema).default([]),
  items: z.array(clauseItemSchema).default([]),
  anchorIds: z.array(z.string()).min(1),
});

export const simplifyResponseSchema = z.object({
  clauses: z.array(clauseCardSchema),
});

// ─── Compare ──────────────────────────────────────────────────────────────────

export const changeItemSchema = z.object({
  topic: z.string(),
  changeType: z.enum(["added", "removed", "modified"]),
  before: z.string().nullable().optional(),
  after: z.string().nullable().optional(),
  whyReview: z.string(),
  anchorIdsA: z.array(z.string()).default([]),
  anchorIdsB: z.array(z.string()).default([]),
});

export const compareResponseSchema = z.object({
  changes: z.array(changeItemSchema),
  structuralDifferences: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
});

// ─── Ask ──────────────────────────────────────────────────────────────────────

export const askCitationSchema = z.object({
  anchorId: z.string(),
  relevance: z.string().optional(),
});

export const askResponseSchema = z.object({
  status: z.enum(["supported", "partially_supported", "not_found"]),
  answer: z.string(),
  notEstablished: z.array(z.string()).default([]),
  anchorIds: z.array(z.string()).default([]),
  citations: z.array(askCitationSchema).optional(),
  confidence: z.string().optional(),
});

// ─── Action Pack ──────────────────────────────────────────────────────────────

export const checklistItemSchema = z.object({
  item: z.string(),
  party: z.string(),
  dueOrTrigger: z.string(),
  anchorIds: z.array(z.string()).min(1),
});

export const lawyerQuestionSchema = z.object({
  question: z.string(),
  reason: z.string(),
  anchorIds: z.array(z.string()).min(1),
});

export const actionPackSchema = z.object({
  checklist: z.array(checklistItemSchema).default([]),
  lawyerQuestions: z.array(lawyerQuestionSchema).default([]),
});
