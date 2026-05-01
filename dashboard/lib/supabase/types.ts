/**
 * Hand-rolled Database type matching docs/schema.sql.
 * Run `supabase gen types typescript` in Phase 5 to auto-generate.
 */

export type ResolutionStatus = "pending" | "resolved" | "false_positive";

export interface Violation {
  id: string;
  camera_id: string;
  violation_type: string;
  confidence: number;
  image_url: string | null;
  detected_at: string;
  resolved_at: string | null;
  resolution_status: ResolutionStatus;
  notes: string | null;
}

export interface Camera {
  id: string;
  site_id: string;
  name: string;
  rtsp_url: string | null;
  created_at: string;
}

export interface Site {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface ViolationWithCamera extends Violation {
  cameras: (Pick<Camera, "name"> & { sites: Pick<Site, "name"> | null }) | null;
}

export interface Database {
  public: {
    Tables: {
      sites: {
        Row: Site;
        Insert: Partial<Site> & { name: string };
        Update: Partial<Site>;
      };
      cameras: {
        Row: Camera;
        Insert: Partial<Camera> & { name: string; site_id: string };
        Update: Partial<Camera>;
      };
      violations: {
        Row: Violation;
        Insert: Partial<Violation> & {
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
