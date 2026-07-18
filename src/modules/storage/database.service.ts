// ============================================================================
// Recall MCP Server — Database Service
// ============================================================================
// Thin wrapper around sql.js providing typed query helpers.
// Auto-creates the data directory and initializes the schema on first use.
//
// Design note: All SQL is colocated in ObservationService, not here.
// This service only exposes low-level DB primitives so it stays swappable
// for a graph DB (Neo4j, SurrealDB, etc.) later without touching business logic.
//
// Uses sql.js (pure JS/WASM SQLite) to avoid native compilation dependencies.
// ============================================================================

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { Injectable } from '@nitrostack/core';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

/** Result type matching the better-sqlite3 RunResult interface */
interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

@Injectable()
export class DatabaseService {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private initialized: Promise<void>;

  constructor() {
    this.dbPath = process.env.DB_PATH || './data/recall.db';

    // Ensure the directory exists before opening the DB
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // sql.js requires async initialization — we queue it and await in methods
    this.initialized = this.init();
  }

  private async init(): Promise<void> {
    const SQL = await initSqlJs();

    // Load existing database file if it exists, otherwise create new
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initializeSchema();
  }

  /** Ensure the DB is ready before any operation */
  async ensureReady(): Promise<void> {
    await this.initialized;
  }

  // ---------------------------------------------------------------------------
  // Schema initialization
  // ---------------------------------------------------------------------------

  /**
   * Creates the observations table and indexes if they don't already exist.
   * Safe to call on every startup — uses IF NOT EXISTS.
   */
  private initializeSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS observations (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL,
        label       TEXT NOT NULL,
        note        TEXT NOT NULL,
        context     TEXT DEFAULT '',
        timestamp   TEXT NOT NULL,
        deleted     INTEGER DEFAULT 0
      );
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(session_id);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_observations_label ON observations(label);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_observations_context ON observations(context);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp);`);
  }

  /** Persist the in-memory database to disk */
  private persist(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  // ---------------------------------------------------------------------------
  // Query helpers — thin, typed wrappers around sql.js
  // ---------------------------------------------------------------------------

  /**
   * Execute a write statement (INSERT, UPDATE, DELETE).
   * Returns the `changes` count and `lastInsertRowid`.
   */
  run(sql: string, params: unknown[] = []): RunResult {
    this.db.run(sql, params as any[]);
    const changes = this.db.getRowsModified();
    this.persist();
    return { changes, lastInsertRowid: 0 };
  }

  /**
   * Fetch a single row. Returns `undefined` if no match.
   */
  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    stmt.bind(params as any[]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  /**
   * Fetch all matching rows.
   */
  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params as any[]);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  /**
   * Gracefully close the database connection.
   */
  close(): void {
    this.persist();
    this.db.close();
  }
}
