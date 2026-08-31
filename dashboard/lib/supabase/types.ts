/**
 * Hand-rolled Database type matching the numbered migrations in
 * all-clear-internal/migrations/. Run `supabase gen types typescript` in
 * Phase 5 to auto-generate.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THESE ARE `type` ALIASES, NOT `interface`. DO NOT CONVERT THEM BACK.
 *
 * The Supabase client requires each table's Row/Insert/Update to satisfy
 * `Record<string, unknown>`. TypeScript gives an implicit index signature to
 * object *type aliases* but NOT to *interfaces* — so with `interface Device`,
 * `Database["public"]` silently failed to satisfy `GenericSchema`, the client
 * fell back to its untyped path, and every query result resolved to `never`.
 *
 * That is why this file's history is full of `as any` casts: they were
 * treating the symptom. Declared as type aliases, the client is properly
 * typed and those casts are unnecessary.
 *
 * `Relationships: []` on each table is required by the same contract. It is
 * empty because we do not yet declare foreign-key metadata; embedded selects
 * (`select("*, cameras(name)")`) therefore still need an explicit result type.
 * ─────────────────────────────────────────────────────────────────────────
 * KNOWN DEPENDENCY MISMATCH — @supabase/ssr 0.5.2 vs supabase-js 2.105.1
 *
 * Clients created by `createClient` from `@supabase/supabase-js` (that is
 * lib/supabase/service-role.ts, and everything under /api/v1/) ARE correctly
 * typed and need no casts.
 *
 * Clients created by `createServerClient` / `createBrowserClient` from
 * `@supabase/ssr` are NOT, and still need `as any`. The cause is not this
 * file. `@supabase/ssr@0.5.2` was written against an older supabase-js and
 * instantiates `SupabaseClient<Database, SchemaName, Schema>` — three generic
 * arguments. supabase-js 2.105.1 declares
 * `SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName, Schema,
 * ClientOptions>` — five. The resolved schema object lands in the
 * `SchemaNameOrClientOptions` slot, fails its constraint, and every Row
 * collapses to `never`.
 *
 * The `^2.45.4` caret in package.json is what let supabase-js float that far
 * ahead of ssr. The fix is a coordinated dependency bump, which touches every
 * auth and cookie path in the app and is deliberately NOT bundled into the
 * Phase 3 auth commit. Until then the `as any` casts in
 * lib/supabase/{server,middleware}.ts and app/api/signed-url/route.ts stay,
 * and each points here.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type ResolutionStatus = "pending" | "resolved" | "false_positive";
export type OrgPlan = "pilot" | "starter" | "pro" | "enterprise";
export type OrgStatus = "active" | "suspended";
export type UserRole = "org_admin" | "supervisor" | "viewer";
export type UserStatus = "active" | "invited" | "disabled";
export type DeviceStatus = "pending" | "active" | "revoked";
export type RecordStatus = "active" | "inactive";

/**
 * Why a violation was tombstoned. Deliberately has no "retention" value:
 * ADR 0007 retention keeps event rows indefinitely and deletes imagery only,
 * which nulls snapshot_s3_key on a LIVE row and is not a tombstone.
 */
export type DeletionReason =
  | "pipa_deletion_request"
  | "legal_order"
  | "operator_error";

/**
 * Columns that feed the tamper-evidence hash (ADR 0003).
 *
 * A BEFORE UPDATE trigger in migration 005 §7 rejects any UPDATE touching
 * these, so an attempt is a runtime error, not a silent chain break. They are
 * excluded from the violations Update type below so it fails at compile time
 * instead.
 */
export type HashedViolationField =
  | "organization_id"
  | "site_id"
  | "camera_id"
  | "violation_type"
  | "confidence"
  | "detected_at"
  | "received_at"
  | "device_id"
  | "event_hash"
  | "prev_hash";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  status: OrgStatus;
  created_at: string;
  updated_at: string;
}

export type User = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type SiteAssignment = {
  id: string;
  organization_id: string;
  user_id: string;
  site_id: string;
  created_at: string;
}

export type Device = {
  id: string;
  organization_id: string;
  site_id: string;
  name: string;
  /** Public half of the split token (ADR 0002). Indexed plaintext, safe to log. */
  key_id: string | null;
  /** SHA-256 of the API key secret. NOT bcrypt — see ADR 0002. Never the raw key. */
  api_key_hash: string | null;
  /** SHA-256 of the one-time provisioning token. Nulled once claimed. */
  provisioning_token_hash: string | null;
  /** 48h TTL on the provisioning token. Nulled once claimed. */
  provisioning_token_expires_at: string | null;
  status: DeviceStatus;
  last_seen_at: string | null;
  /**
   * Chain-tip cache: event_hash of this device's most recent violation
   * (migration 006, ADR 0003 Amendment 3).
   *
   * A pointer, not a source of truth — the chain is fully reconstructible from
   * `violations` alone. Only `ingest_violation()` writes it, inside the same
   * transaction as the insert it points at. Never set it from application code.
   */
  last_event_hash: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditLog = {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type Violation = {
  id: string;
  organization_id: string;
  site_id: string;
  camera_id: string;
  device_id: string | null;
  violation_type: string;
  confidence: number;
  snapshot_s3_key: string | null;
  idempotency_key: string | null;
  detected_at: string;
  /**
   * Server-assigned receipt time and a hash-chain input (ADR 0003).
   * Never accept this from a device — a device clock is forgeable by the device.
   */
  received_at: string;
  /** SHA-256 over the canonical event serialization (ADR 0003). */
  event_hash: string | null;
  /** The previous violation's event_hash for this device. Null = first in chain. */
  prev_hash: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_status: ResolutionStatus;
  notes: string | null;

  /**
   * Tombstone marker (ADR 0003 Amendment 1). Null = live.
   *
   * A violation is NEVER physically deleted — that breaks the hash chain from
   * this row forward. Legitimate removals null the unhashed content
   * (notes, snapshot_s3_key) and set these three instead.
   *
   * EVERY read path must filter on `deleted_at IS NULL`. Missing it anywhere
   * resurfaces removed content, which is a data-handling failure and not a
   * display bug. Prefer the shared helper over repeating the predicate.
   */
  deleted_at: string | null;
  deletion_reason: DeletionReason | null;
  deleted_by: string | null;
}

export type Camera = {
  id: string;
  organization_id: string;
  site_id: string;
  device_id: string | null;
  name: string;
  zone: string | null;
  rtsp_url: string | null;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export type Site = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  timezone: string;
  status: RecordStatus;
  pipa_attestation_completed: boolean;
  pipa_attestation_by: string | null;
  pipa_attestation_at: string | null;
  /**
   * Opt-in imagery capture (ADR 0001). Default false. A snapshot offered to a
   * site with this false must be rejected with an explicit 400, never silently
   * discarded.
   */
  snapshot_mode: boolean;
  created_at: string;
  updated_at: string;
}

export type ViolationWithCamera = Violation & {
  cameras: (Pick<Camera, "name"> & { sites: Pick<Site, "name"> | null }) | null;
}

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Partial<Organization> & { name: string; slug: string };
        Update: Partial<Organization>;
        Relationships: [];
      };
      users: {
        Row: User;
        Insert: Partial<User> & { id: string; organization_id: string; email: string };
        Update: Partial<User>;
        Relationships: [];
      };
      site_assignments: {
        Row: SiteAssignment;
        Insert: Partial<SiteAssignment> & { organization_id: string; user_id: string; site_id: string };
        Update: Partial<SiteAssignment>;
        Relationships: [];
      };
      devices: {
        Row: Device;
        Insert: Partial<Device> & { organization_id: string; site_id: string; name: string };
        Update: Partial<Device>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & { organization_id: string; action: string; target_type: string };
        Update: Partial<AuditLog>;
        Relationships: [];
      };
      sites: {
        Row: Site;
        Insert: Partial<Site> & { name: string; organization_id: string };
        Update: Partial<Site>;
        Relationships: [];
      };
      cameras: {
        Row: Camera;
        Insert: Partial<Camera> & { name: string; site_id: string; organization_id: string };
        Update: Partial<Camera>;
        Relationships: [];
      };
      violations: {
        Row: Violation;
        Insert: Partial<Violation> & {
          organization_id: string;
          site_id: string;
          camera_id: string;
          violation_type: string;
          confidence: number;
        };
        // Hashed columns are omitted: the database trigger rejects updating
        // them, so allowing them here would only move the failure to runtime.
        // To remove content from a violation, tombstone it — set deleted_at
        // and deletion_reason and null notes / snapshot_s3_key.
        Update: Partial<Omit<Violation, HashedViolationField>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    /**
     * The plpgsql functions installed by migration 006.
     *
     * These are typed here so `supabase.rpc(...)` is checked at compile time —
     * a renamed argument or a misread return column becomes a build failure
     * instead of a runtime `undefined` at 3am. The argument names must match
     * the SQL parameter names exactly, `p_` prefixes included, because
     * PostgREST passes them as named JSON keys.
     *
     * All four are EXECUTE-revoked from anon and authenticated and granted only
     * to service_role (migration 006 §8), so they are reachable exclusively
     * through lib/supabase/service-role.ts. Calling them with the anon client
     * will type-check and then fail at runtime with a permission error — which
     * is the correct outcome, and is asserted by 006_verification_tests.sql.
     */
    Functions: {
      /**
       * Atomic device provisioning claim, including the Alberta PIPA
       * attestation gate. Returns exactly one row.
       *
       * `reason` mapping for the endpoint:
       *   claimed            → 200, return the API key once
       *   not_found          → 400, ONE generic message covering unknown,
       *                        already-claimed and expired tokens alike
       *   site_not_attested  → 403, naming attestation specifically
       */
      claim_device: {
        Args: {
          p_provisioning_token_hash: string;
          p_key_id: string;
          p_api_key_hash: string;
        };
        Returns: {
          reason: "claimed" | "not_found" | "site_not_attested";
          claimed_device_id: string | null;
          claimed_organization_id: string | null;
          claimed_site_id: string | null;
        }[];
      };

      /**
       * The whole violation ingestion critical section, under a device row
       * lock. Returns exactly one row.
       *
       * Raises custom SQLSTATEs which arrive as `error.code`:
       *   AC001 camera not at this device's site   → 403
       *   AC002 snapshot requested, mode off       → 400
       *   AC003 device missing or not active       → 403
       *   AC004 violation_type unusable            → 400
       *   AC005 confidence out of range            → 400
       *   AC006 detected_at in the future          → 400
       */
      ingest_violation: {
        Args: {
          p_device_id: string;
          p_camera_id: string;
          p_violation_type: string;
          p_confidence: number;
          p_detected_at: string;
          p_idempotency_key: string;
          p_snapshot_requested?: boolean;
        };
        Returns: {
          violation_id: string;
          /** true → the endpoint answers 200 with the existing row, not 201. */
          is_duplicate: boolean;
          hash: string;
          received: string;
          org_id: string;
          site: string;
          /** Whether the site has snapshot mode on, for the presigned-URL step. */
          snapshot_enabled: boolean;
        }[];
      };

      /**
       * Durable fixed-window rate limiter. Counts the call it is asked about,
       * so `allowed = false` means THIS request is over the limit.
       *
       * `p_bucket` must be built from the PUBLIC key_id half of an API key or
       * from an IP — never from a secret. Use the helpers in lib/rate-limit.ts.
       */
      check_rate_limit: {
        Args: {
          p_bucket: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };

      /**
       * SHA-256 over the frozen canonical event serialization (ADR 0003
       * Amendment 3). Present for completeness and for verification tooling.
       *
       * Application code should NOT call this to compute a hash for storage —
       * `ingest_violation` seals rows itself, under the lock, which is the
       * only place a hash may be produced.
       */
      allclear_event_hash: {
        Args: {
          p_device_id: string;
          p_organization_id: string;
          p_site_id: string;
          p_camera_id: string;
          p_violation_type: string;
          p_confidence: number;
          p_detected_at: string;
          p_received_at: string;
          p_prev_hash: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
