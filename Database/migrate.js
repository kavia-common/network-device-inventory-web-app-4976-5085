#!/usr/bin/env node
/**
 * Lightweight migration runner supporting PostgreSQL and SQLite.
 * - Reads DB_CLIENT (pg|sqlite) and DATABASE_URL from environment (.env supported if user exports).
 * - Applies SQL files in migrations/ directory in lexicographic order.
 * - For SQLite, ensures ./data/devices.db exists and is writable.
 * - For PostgreSQL, connects using pg Pool and runs SQL sequentially.
 *
 * Usage:
 *   DB_CLIENT=sqlite DATABASE_URL=sqlite://./data/devices.db node migrate.js
 *   DB_CLIENT=pg DATABASE_URL=postgres://user:pass@localhost:5432/dbname node migrate.js
 *
 * Optional:
 *   DB_SSL=true|false
 */

const fs = require('fs');
const path = require('path');

// Try to load .env if present (best-effort, no dependency on dotenv)
(function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq > -1) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
})();

const DB_CLIENT = (process.env.DB_CLIENT || 'sqlite').toLowerCase();
const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_SSL = (process.env.DB_SSL || 'false').toLowerCase() === 'true';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SQLITE_DEFAULT_PATH = path.join(__dirname, 'data', 'devices.db');

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function readSqlFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Normalize and prepare SQLite path
function resolveSqlitePath(url) {
  // Accept forms:
  // - sqlite://./data/devices.db
  // - sqlite:///absolute/path/to/devices.db
  // - ./data/devices.db
  // - data/devices.db
  if (!url) return SQLITE_DEFAULT_PATH;

  if (url.startsWith('sqlite://')) {
    const pathPart = url.replace('sqlite://', '');
    if (pathPart.startsWith('/')) {
      // absolute path
      return pathPart;
    }
    // relative path from this directory
    return path.join(__dirname, pathPart);
  }
  // treat as filesystem path
  if (path.isAbsolute(url)) return url;
  return path.join(__dirname, url);
}

async function runSqliteMigrations() {
  const sqlitePath = resolveSqlitePath(DATABASE_URL);
  const dataDir = path.dirname(sqlitePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(sqlitePath)) {
    // create empty file
    fs.writeFileSync(sqlitePath, '');
  }

  const sqlite3 = require('sqlite3').verbose();

  console.log(`Using SQLite database at: ${sqlitePath}`);
  const db = new sqlite3.Database(sqlitePath);

  const migrations = listMigrations();
  for (const fname of migrations) {
    const full = path.join(MIGRATIONS_DIR, fname);
    const sql = readSqlFile(full);

    console.log(`Applying migration: ${fname}`);
    // Split on ; to execute statements separately; ignore empty/whitespace
    const statements = sql
      .split(/;\s*$/m).join(';\n') // normalize line endings
      .split(/;\s*\n/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.exec('BEGIN;', (err) => {
          if (err) return reject(err);
          // Execute statements sequentially
          (function next(i) {
            if (i >= statements.length) {
              return db.exec('COMMIT;', (cerr) => (cerr ? reject(cerr) : resolve()));
            }
            db.exec(statements[i], (e) => {
              if (e) {
                // If adding constraint fails (SQLite limitation), try to continue by rolling back this tx and warn
                console.warn(`Warning executing statement in ${fname}: ${e.message}`);
                return db.exec('ROLLBACK;', () => {
                  // Best-effort: attempt to run whole file as a single exec to allow IF NOT EXISTS patterns
                  db.exec(sql, (e2) => {
                    if (e2) return reject(new Error(`Failed migration ${fname}: ${e2.message}`));
                    return resolve();
                  });
                });
              }
              next(i + 1);
            });
          })(0);
        });
      });
    });
  }

  db.close();
  console.log('All SQLite migrations applied successfully.');
}

function parsePgConfig(url) {
  // Let pg parse it natively by providing connectionString
  return {
    connectionString: url,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
  };
}

async function runPostgresMigrations() {
  if (!DATABASE_URL || !DATABASE_URL.startsWith('postgres')) {
    throw new Error('For DB_CLIENT=pg you must provide a valid DATABASE_URL starting with postgres:// or postgresql://');
  }
  const { Pool } = require('pg');
  const config = parsePgConfig(DATABASE_URL);
  const pool = new Pool(config);

  const client = await pool.connect();
  try {
    const migrations = listMigrations();
    for (const fname of migrations) {
      const full = path.join(MIGRATIONS_DIR, fname);
      const sql = readSqlFile(full);

      console.log(`Applying migration: ${fname}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        // If CHECK constraint already exists, or index exists, ignore by logging and continue when safe
        console.error(`Error running ${fname}: ${e.message}`);
        throw e;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log('All PostgreSQL migrations applied successfully.');
}

(async function main() {
  try {
    console.log(`Migration runner starting with DB_CLIENT=${DB_CLIENT}`);
    if (DB_CLIENT === 'sqlite') {
      await runSqliteMigrations();
    } else if (DB_CLIENT === 'pg' || DB_CLIENT === 'postgres' || DB_CLIENT === 'postgresql') {
      await runPostgresMigrations();
    } else {
      throw new Error(`Unsupported DB_CLIENT "${DB_CLIENT}". Use "sqlite" or "pg".`);
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
})();
