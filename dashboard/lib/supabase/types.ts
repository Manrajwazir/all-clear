/**
 * Hand-rolled Database type matching docs/schema.sql and Schema v2 migrations.
 * Run `supabase gen types typescript` in Phase 5 to auto-generate.
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

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  status: OrgStatus;
  created_at: string;
  updated_at: string;
}

export interface User {
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

export interface SiteAssignment {
  id: string;
  organization_id: string;
  user_id: string;
  site_id: string;
  created_at: string;
}

export interface Device {
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
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Violation {
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

export interface Camera {
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

export interface Site {
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

export interface ViolationWithCamera extends Violation {
  cameras: (Pick<Camera, "name"> & { sites: Pick<Site, "name"> | null }) | null;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Partial<Organization> & { name: string; slug: string };
        Update: Partial<Organization>;
      };
      users: {
        Row: User;
        Insert: Partial<User> & { id: string; organization_id: string; email: string };
        Update: Partial<User>;
      };
      site_assignments: {
        Row: SiteAssignment;
        Insert: Partial<SiteAssignment> & { organization_id: string; user_id: string; site_id: string };
        Update: Partial<SiteAssignment>;
      };
      devices: {
        Row: Device;
        Insert: Partial<Device> & { organization_id: string; site_id: string; name: string };
        Update: Partial<Device>;
      };
      audit_log: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & { organization_id: string; action: string; target_type: string };
        Update: Partial<AuditLog>;
      };
      sites: {
        Row: Site;
        Insert: Partial<Site> & { name: string; organization_id: string };
        Update: Partial<Site>;
      };
      cameras: {
        Row: Camera;
        Insert: Partial<Camera> & { name: string; site_id: string; organization_id: string };
        Update: Partial<Camera>;
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
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
