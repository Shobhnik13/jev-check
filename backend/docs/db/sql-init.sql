-- Runs on every backend start, so every statement is idempotent: nothing is dropped.

DO $$ BEGIN CREATE TYPE item_type AS ENUM ('present', 'state', 'yesno'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE match_mode AS ENUM ('kind', 'exact'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE run_source AS ENUM ('snap', 'live', 'upload', 'api'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verdict AS ENUM ('pass', 'fail', 'review', 'retake'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE outcome AS ENUM ('pass', 'fail'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- An anonymous owner: one per browser until devices are linked. All data hangs off it.
CREATE TABLE IF NOT EXISTS owners (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL
);

-- One per browser. Only the SHA-256 of the cookie token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  user_agent TEXT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_sessions_owner_id FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_owner_id ON sessions(owner_id);

-- Short-lived codes that let another browser join the same owner.
CREATE TABLE IF NOT EXISTS device_links (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_device_links_owner_id FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE INDEX IF NOT EXISTS idx_device_links_code ON device_links(code);
CREATE INDEX IF NOT EXISTS idx_device_links_owner_id ON device_links(owner_id);

CREATE TABLE IF NOT EXISTS objects (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_objects_owner_id FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE INDEX IF NOT EXISTS idx_objects_owner_id ON objects(owner_id);

CREATE TABLE IF NOT EXISTS object_references (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_id INTEGER NOT NULL,
  image TEXT NOT NULL,
  crop TEXT NOT NULL,
  box JSONB NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_object_references_object_id FOREIGN KEY (object_id) REFERENCES objects(id)
);

CREATE INDEX IF NOT EXISTS idx_object_references_object_id ON object_references(object_id);

CREATE TABLE IF NOT EXISTS checklists (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  webhook_url TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_checklists_owner_id FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE INDEX IF NOT EXISTS idx_checklists_owner_id ON checklists(owner_id);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checklist_id INTEGER NOT NULL,
  object_id INTEGER NULL,
  type item_type NOT NULL,
  question TEXT NULL,
  options JSONB NULL,
  pass_options JSONB NULL,
  expect_present BOOLEAN NOT NULL DEFAULT TRUE,
  match match_mode NOT NULL DEFAULT 'kind',
  threshold REAL NOT NULL DEFAULT 0.7,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_checklist_items_checklist_id FOREIGN KEY (checklist_id) REFERENCES checklists(id),
  CONSTRAINT fk_checklist_items_object_id FOREIGN KEY (object_id) REFERENCES objects(id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_object_id ON checklist_items(object_id);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  checklist_id INTEGER NOT NULL,
  source run_source NOT NULL,
  image TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  quality REAL NOT NULL,
  verdict verdict NOT NULL,
  final_verdict outcome NULL,
  results JSONB NOT NULL,
  latency_ms INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL,
  model TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_runs_owner_id FOREIGN KEY (owner_id) REFERENCES owners(id),
  CONSTRAINT fk_runs_checklist_id FOREIGN KEY (checklist_id) REFERENCES checklists(id)
);

CREATE INDEX IF NOT EXISTS idx_runs_owner_id ON runs(owner_id);
CREATE INDEX IF NOT EXISTS idx_runs_checklist_id ON runs(checklist_id);
CREATE INDEX IF NOT EXISTS idx_runs_verdict ON runs(verdict);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  outcome outcome NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT fk_reviews_run_id FOREIGN KEY (run_id) REFERENCES runs(id),
  CONSTRAINT fk_reviews_item_id FOREIGN KEY (item_id) REFERENCES checklist_items(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_run_id_item_id ON reviews(run_id, item_id);
