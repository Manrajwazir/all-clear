/**
 * Input validation schemas using Zod.
 * Phase 2, Step 2.7
 *
 * Every API route validates its input at the boundary before any business
 * logic runs. This prevents:
 *   - Path traversal (../../../etc/passwd in S3 keys)
 *   - Type coercion bugs (string where number expected)
 *   - Oversized uploads that exhaust memory
 *   - Invalid enum values that bypass business logic
 *
 * On validation failure, routes return 400 with the Zod error messages.
 * These are safe to return — they describe the schema, not your internals.
 */

import { z } from "zod";

// ─── Signed URL Route ───────────────────────────────────────────────

export const signedUrlSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .max(500, "Key too long")
    .startsWith("violations/", "Key must start with violations/")
    .regex(/^[a-zA-Z0-9\-_/.:]+$/, "Invalid characters in key")
    .refine((key) => !key.includes(".."), "Path traversal not allowed"),
});

// ─── Violation Ingestion (Phase 3) ──────────────────────────────────

export const violationSubmitSchema = z.object({
  violation_type: z.enum([
    "no_hardhat",
    "no_safety_vest",
    "no_mask",
    "no_gloves",
    "no_goggles",
  ]),
  confidence: z.number().min(0).max(1),
  detected_at: z.string().datetime(),
  camera_id: z.string().uuid(),
  snapshot_s3_key: z.string().max(500).optional(),
});

// ─── Device Provisioning (Phase 3) ──────────────────────────────────

export const provisionDeviceSchema = z.object({
  provisioning_token: z
    .string()
    .min(32, "Token too short")
    .max(128, "Token too long"),
});

// ─── Device Heartbeat (Phase 3) ─────────────────────────────────────

export const heartbeatSchema = z.object({
  status: z.enum(["online", "degraded", "error"]),
  cpu_temp: z.number().optional(),
  uptime_seconds: z.number().int().nonnegative().optional(),
  model_version: z.string().max(50).optional(),
});

// ─── Violation Resolution (Dashboard) ───────────────────────────────

export const resolveViolationSchema = z.object({
  resolution_status: z.enum(["resolved", "false_positive"]),
  notes: z.string().max(1000).optional(),
});

// ─── UUID parameter validation ──────────────────────────────────────

export const uuidParam = z.string().uuid("Invalid ID format");
