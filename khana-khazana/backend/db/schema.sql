-- Khana-Khajana NeonDB PostgreSQL Schema
-- Normalized tables for real-time floor state, reservations, recipe inventory, kitchen orders, and AI audit telemetry.

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  zone TEXT NOT NULL CHECK (zone IN ('Window', 'Main Hall', 'VIP Lounge')),
  is_accessible BOOLEAN NOT NULL DEFAULT FALSE,
  is_vip_booth BOOLEAN NOT NULL DEFAULT FALSE,
  combinable_with TEXT,
  status TEXT NOT NULL CHECK (status IN ('Free', 'Occupied', 'Paying', 'Dirty')),
  current_course TEXT NOT NULL CHECK (current_course IN ('None', 'Appetizer', 'Mains', 'Dessert', 'Billing')),
  elapsed_mins INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_mins >= 0),
  assigned_party_id TEXT,
  assigned_party_name TEXT,
  assigned_party_size INTEGER,
  active_booking_id TEXT,
  grid_col INTEGER NOT NULL DEFAULT 0,
  grid_row INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waiting_queue (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  needs_wheelchair BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_zone TEXT NOT NULL,
  dietary_notes TEXT,
  wait_mins INTEGER NOT NULL DEFAULT 0 CHECK (wait_mins >= 0),
  status TEXT NOT NULL CHECK (status IN ('WAITING', 'SEATED')),
  booking_id TEXT,
  created_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  booking_id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_time TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  preferred_zone TEXT NOT NULL,
  needs_wheelchair BOOLEAN NOT NULL DEFAULT FALSE,
  is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  special_requests TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('CONFIRMED', 'CHECKED_IN', 'SEATED', 'COMPLETED', 'CANCELLED')),
  assigned_table_ids JSONB NOT NULL,
  qr_pass_code TEXT NOT NULL,
  triggered_rules JSONB NOT NULL,
  bayesian_confidence_pct INTEGER NOT NULL,
  f_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_datetime ON reservations (date_time);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'mg', 'ml', 'pcs')),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  par_level INTEGER NOT NULL CHECK (par_level > 0),
  per_order_highlight TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_dishes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  prep_mins INTEGER NOT NULL CHECK (prep_mins > 0),
  dietary_tags JSONB NOT NULL,
  is_veg BOOLEAN NOT NULL DEFAULT TRUE,
  image TEXT NOT NULL,
  recipe JSONB NOT NULL,
  substitute_dish_ids JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS kitchen_orders (
  order_id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES restaurant_tables(id) ON UPDATE CASCADE,
  booking_id TEXT,
  items JSONB NOT NULL,
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  prep_time_mins INTEGER NOT NULL CHECK (prep_time_mins > 0),
  status TEXT NOT NULL CHECK (status IN ('Order Received', 'Preparing', 'Waiter En Route', 'Served')),
  dispatched_agent_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_orders_table ON kitchen_orders (table_id);

CREATE TABLE IF NOT EXISTS waiter_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  zone TEXT NOT NULL,
  current_action TEXT NOT NULL,
  target_table_id TEXT,
  energy_pct INTEGER NOT NULL,
  utility_score REAL NOT NULL,
  utility_breakdown JSONB NOT NULL,
  tasks_completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  tick INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  utility_score REAL,
  target_table_id TEXT,
  message TEXT NOT NULL,
  created_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_created ON agent_events (created_ts DESC);

CREATE TABLE IF NOT EXISTS xai_audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  party_name TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  assigned_tables JSONB NOT NULL,
  algorithm TEXT NOT NULL,
  f_score REAL NOT NULL,
  bayesian_prob REAL NOT NULL,
  rules_applied JSONB NOT NULL,
  justification TEXT NOT NULL,
  created_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xai_audit_created ON xai_audit_logs (created_ts DESC);
