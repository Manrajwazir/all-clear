-- ============================================================
-- SiteIQ — Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- Sites (your customers' physical locations)
CREATE TABLE sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  address     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Cameras registered to sites
CREATE TABLE cameras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES sites(id),
  name        TEXT NOT NULL,
  rtsp_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- The violations table — the heart of the product
-- ============================================================
CREATE TABLE violations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id          UUID REFERENCES cameras(id),
  violation_type     TEXT NOT NULL,        -- 'no_helmet', 'no_vest', 'no_mask'
  confidence         FLOAT NOT NULL,       -- 0.0 to 1.0
  image_url          TEXT,                 -- S3 URL of the snapshot
  detected_at        TIMESTAMPTZ DEFAULT NOW(),
  resolved_at        TIMESTAMPTZ,
  resolution_status  TEXT DEFAULT 'pending',  -- 'pending', 'resolved', 'false_positive'
  notes              TEXT
);

-- Indexes for fast dashboard queries
CREATE INDEX idx_violations_detected_at ON violations(detected_at DESC);
CREATE INDEX idx_violations_camera      ON violations(camera_id);

-- Enable Realtime so the dashboard gets live push updates when a row is inserted
ALTER PUBLICATION supabase_realtime ADD TABLE violations;

-- ============================================================
-- Seed data for MVP (one site, one camera — matches CAMERA_ID in main.py)
-- ============================================================

-- Insert the MVP site
INSERT INTO sites (id, name, address)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'SiteIQ MVP Site',
  'Edmonton, AB'
);

-- Insert the MVP camera (UUID must match CAMERA_ID in main.py)
INSERT INTO cameras (id, site_id, name, rtsp_url)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Webcam Dev Camera',
  NULL  -- NULL = laptop webcam; replace with rtsp://... for IP camera
);
