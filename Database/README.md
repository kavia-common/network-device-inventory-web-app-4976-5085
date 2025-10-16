# Database: Network Device Inventory

This directory contains the database migrations and a lightweight migration runner supporting both SQLite (default) and PostgreSQL.

Contents:
- migrations/
  - 001_init.sql: create devices table
  - 002_indexes.sql: add indexes
  - 003_seed.sql: optional seed data
- migrate.js: Node-based migration runner
- .env.example: environment examples
- data/: SQLite database location (created automatically)
- db_visualizer/: utility provided in repo (not required for migrations)

## Schema

Table: devices
- id INTEGER PRIMARY KEY (autoincrement/serial depending on engine)
- name TEXT NOT NULL
- ip_address TEXT NOT NULL UNIQUE
- mac_address TEXT NOT NULL UNIQUE
- device_type TEXT NOT NULL
- location TEXT NOT NULL
- status TEXT NOT NULL DEFAULT 'unknown' with CHECK(status IN ('online','offline','unknown')) if supported
- last_ping TIMESTAMP NULL

Indexes:
- idx_devices_ip_address (ip_address)
- idx_devices_mac_address (mac_address)
- idx_devices_device_type (device_type)

## Configure environment

Copy .env.example to .env and adjust as needed (or export env variables in your shell).

SQLite (default):
- DB_CLIENT=sqlite
- DATABASE_URL=sqlite://./data/devices.db

PostgreSQL:
- DB_CLIENT=pg
- DATABASE_URL=postgres://appuser:dbuser123@localhost:5432/devices
- DB_SSL=false

Note: Do not commit real secrets. The .env file is not provided here.

## Run migrations

Prerequisites:
- Node.js runtime available in your environment
- For PostgreSQL: database reachable by the URL provided

Commands:
- SQLite:
  DB_CLIENT=sqlite DATABASE_URL=sqlite://./data/devices.db node migrate.js

- PostgreSQL:
  DB_CLIENT=pg DATABASE_URL=postgres://appuser:dbuser123@localhost:5432/devices DB_SSL=false node migrate.js

The runner:
- Applies SQL files in migrations/ in lexicographic order
- Creates ./data/devices.db automatically for SQLite if it doesn't exist
- Runs each SQL file inside a transaction on PostgreSQL

## Seeds

003_seed.sql inserts a couple of example devices. If duplicates exist (same ip_address), inserts are skipped where possible.

## Notes

- The CHECK constraint on status is included; both PostgreSQL and modern SQLite recognize CHECK. If unsupported in a given SQLite build, the runner attempts to proceed safely.
- This directory only provides schema and migration tooling; do not start services here.
