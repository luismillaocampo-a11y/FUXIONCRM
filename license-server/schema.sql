-- Servidor de licencias NutraFlow CRM (referencia, PostgreSQL/Supabase).
-- Una sola tabla. El cliente habla únicamente con POST /api/checkin.

CREATE TABLE IF NOT EXISTS installations (
  install_id TEXT PRIMARY KEY,
  hwid TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'PRO',          -- 'BASICO' | 'PRO'
  status TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'blocked'
  seats INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installations_hwid ON installations (hwid);
CREATE INDEX IF NOT EXISTS idx_installations_status ON installations (status);
