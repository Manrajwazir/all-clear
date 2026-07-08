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
  provisioning_token: string | null;
  api_key_hash: string | null;
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
  detected_at: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_status: ResolutionStatus;
  notes: string | null;
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
        Update: Partial<Violation>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
