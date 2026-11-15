-- Field Shift PostgreSQL Schema for Farmer Accounts & Saved Rotation Plans
-- Compatible with PostgreSQL 14+ / Netlify Database (NETLIFY_DB_URL / DATABASE_URL)

CREATE TABLE IF NOT EXISTS farmer_accounts (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    farm_name TEXT DEFAULT '',
    default_region TEXT DEFAULT 'regionA',
    farm_size_ha NUMERIC(10, 2) DEFAULT 10.0,
    preferred_lang TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_farm_plans (
    id SERIAL PRIMARY KEY,
    farmer_id INTEGER NOT NULL REFERENCES farmer_accounts(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    region TEXT NOT NULL,
    rotation JSONB NOT NULL,
    allowed_crops JSONB NOT NULL,
    priorities JSONB NOT NULL,
    scenario JSONB NOT NULL,
    top_score NUMERIC(6, 2),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_farm_plans_farmer_id ON saved_farm_plans(farmer_id);

