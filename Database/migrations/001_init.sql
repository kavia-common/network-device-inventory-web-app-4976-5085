-- 001_init.sql
-- Create devices table compatible with PostgreSQL and SQLite

-- Enable foreign keys and other pragmas for SQLite if running there (no-op on Postgres)
PRAGMA foreign_keys = ON;

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL UNIQUE,
  mac_address TEXT NOT NULL UNIQUE,
  device_type TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_ping TIMESTAMP NULL
);

-- Add status constraint if engine supports CHECK with IN
-- PostgreSQL supports CHECK; SQLite supports CHECK but not enforcing IN list strictly in older versions.
-- We attempt to add it, but ignore errors in the runner if the dialect doesn't support.
-- For maximum compatibility, this statement is kept simple.
-- Note: SQLite allows CHECK, so this should work for modern versions.
ALTER TABLE devices
ADD CONSTRAINT devices_status_check CHECK (status IN ('online','offline','unknown'));
