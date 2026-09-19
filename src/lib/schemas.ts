/**
 * Zod validation schemas for all model outputs and structured objects in Clauseora.
 * Used for strict fail-closed validation of LLM output.
 */

import { z } from "zod";

const anchorIdSchema = z.string().min(1).max(128);
const shortTextSchema = z.string().min(1).max(500);
const explanationSchema = z.string().min(1).max(5_000);
const anchorIdsSchema = z.array(anchorIdSchema).min(1).max(100);
const optionalTextSchema = z.string().min(1).max(5_000);

// ─── Simplify ─────────────────────────────────────────────────────────────────

export const clauseItemSchema = z.object({
  kind: z.enum(["obligation", "deadline", "money", "condition", "review_flag"]),
  party: shortTextSchema,
  statement: explanationSchema,
  anchorIds: anchorIdsSchema,
});

export const definedTermSchema = z.object({
  term: shortTextSchema,
  meaningInContext: explanationSchema,
  anchorIds: z.array(anchorIdSchema).max(100).optional(),
});

export const clauseCardSchema = z.object({
  topic: shortTextSchema,
  plainLanguage: explanationSchema,
  definedTerms: z.array(definedTermSchema).max(50).default([]),
  items: z.array(clauseItemSchema).max(50).default([]),
  anchorIds: anchorIdsSchema,
});

export const simplifyResponseSchema = z.object({
  clauses: z.array(clauseCardSchema).max(100),
});

// ─── Compare ──────────────────────────────────────────────────────────────────

export const changeItemSchema = z.object({
  topic: shortTextSchema,
  changeType: z.enum(["added", "removed", "modified"]),
  before: optionalTextSchema.nullable().optional(),
  after: optionalTextSchema.nullable().optional(),
  whyReview: explanationSchema,
  anchorIdsA: z.array(anchorIdSchema).max(100).default([]),
  anchorIdsB: z.array(anchorIdSchema).max(100).default([]),
});

export const compareResponseSchema = z.object({
  changes: z.array(changeItemSchema).max(100),
  structuralDifferences: z.array(explanationSchema).max(50).optional(),
  recommendations: z.array(explanationSchema).max(50).optional(),
});

// ─── Ask ──────────────────────────────────────────────────────────────────────

export const askCitationSchema = z.object({
  anchorId: anchorIdSchema,
  relevance: z.string().max(500).optional(),
});

export const askResponseSchema = z.object({
  status: z.enum(["supported", "partially_supported", "not_found"]),
  answer: z.string().max(5_000),
  notEstablished: z.array(explanationSchema).max(20).default([]),
  anchorIds: z.array(anchorIdSchema).max(100).default([]),
  citations: z.array(askCitationSchema).max(100).optional(),
  confidence: z.string().max(100).optional(),
});

// ─── Action Pack ──────────────────────────────────────────────────────────────

export const checklistItemSchema = z.object({
  item: explanationSchema,
  party: shortTextSchema,
  dueOrTrigger: explanationSchema,
  anchorIds: anchorIdsSchema,
});

export const lawyerQuestionSchema = z.object({
  question: explanationSchema,
  reason: explanationSchema,
  anchorIds: anchorIdsSchema,
});

export const actionPackSchema = z.object({
  checklist: z.array(checklistItemSchema).max(100).default([]),
  lawyerQuestions: z.array(lawyerQuestionSchema).max(5).default([]),
});
