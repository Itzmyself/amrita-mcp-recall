// ============================================================================
// Recall MCP Server — Observation Service
// ============================================================================
// Business logic for creating, querying, updating, and deleting observations.
// Injected into tools, resources, and prompts via NitroStack DI.
//
// All SQL lives here (not in DatabaseService) so swapping the storage backend
// only requires replacing this one file.
// ============================================================================

import { Injectable } from '@nitrostack/core';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../storage/database.service.js';
import type {
  Observation,
  SessionSummary,
  SessionGraph,
  Relation,
} from './types.js';

@Injectable()
export class ObservationService {
  constructor(private db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // CRUD Operations
  // ---------------------------------------------------------------------------

  /**
   * Capture a new observation. Generates a UUID and ISO timestamp automatically.
   */
  async create(
    label: string,
    note: string,
    context: string,
    sessionId: string,
  ): Promise<Observation> {
    await this.db.ensureReady();

    const id = uuidv4();
    const timestamp = new Date().toISOString();

    this.db.run(
      `INSERT INTO observations (id, session_id, label, note, context, timestamp, deleted)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, sessionId, label, note, context || '', timestamp],
    );

    return { id, session_id: sessionId, label, note, context: context || '', timestamp, deleted: 0 };
  }

  /**
   * Retrieve a single observation by ID (excluding soft-deleted).
   */
  async getById(id: string): Promise<Observation | null> {
    await this.db.ensureReady();

    const row = this.db.get<Observation>(
      `SELECT * FROM observations WHERE id = ? AND deleted = 0`,
      [id],
    );
    return row || null;
  }

  /**
   * Update the note text of an existing observation.
   * Returns the updated record, or null if not found.
   */
  async update(id: string, newNote: string): Promise<Observation | null> {
    await this.db.ensureReady();

    const result = this.db.run(
      `UPDATE observations SET note = ? WHERE id = ? AND deleted = 0`,
      [newNote, id],
    );

    if (result.changes === 0) return null;
    return this.getById(id);
  }

  /**
   * Soft-delete an observation by setting `deleted = 1`.
   * Returns true if a record was actually updated, false if not found.
   */
  async softDelete(id: string): Promise<boolean> {
    await this.db.ensureReady();

    const result = this.db.run(
      `UPDATE observations SET deleted = 1 WHERE id = ? AND deleted = 0`,
      [id],
    );
    return result.changes > 0;
  }

  // ---------------------------------------------------------------------------
  // Search & Query
  // ---------------------------------------------------------------------------

  /**
   * Search observations by keyword across label, note, and context fields.
   * Optionally scoped to a specific session. Returns newest first.
   */
  async search(query: string, sessionId?: string): Promise<Observation[]> {
    await this.db.ensureReady();

    const pattern = `%${query}%`;

    if (sessionId) {
      return this.db.all<Observation>(
        `SELECT * FROM observations
         WHERE deleted = 0
           AND session_id = ?
           AND (label LIKE ? OR note LIKE ? OR context LIKE ?)
         ORDER BY timestamp DESC`,
        [sessionId, pattern, pattern, pattern],
      );
    }

    return this.db.all<Observation>(
      `SELECT * FROM observations
       WHERE deleted = 0
         AND (label LIKE ? OR note LIKE ? OR context LIKE ?)
       ORDER BY timestamp DESC`,
      [pattern, pattern, pattern],
    );
  }

  /**
   * List all sessions with their observation counts and date ranges.
   */
  async listSessions(): Promise<SessionSummary[]> {
    await this.db.ensureReady();

    return this.db.all<SessionSummary>(
      `SELECT
         session_id,
         COUNT(*) as observation_count,
         MIN(timestamp) as first_observation,
         MAX(timestamp) as last_observation
       FROM observations
       WHERE deleted = 0
       GROUP BY session_id
       ORDER BY last_observation DESC`,
    );
  }

  /**
   * Get all active observations for a session, ordered chronologically.
   */
  async getSessionObservations(sessionId: string): Promise<Observation[]> {
    await this.db.ensureReady();

    return this.db.all<Observation>(
      `SELECT * FROM observations
       WHERE session_id = ? AND deleted = 0
       ORDER BY timestamp ASC`,
      [sessionId],
    );
  }

  // ---------------------------------------------------------------------------
  // Graph Construction
  // ---------------------------------------------------------------------------

  /**
   * Build a structured graph of all observations in a session.
   * Infers relations between observations that share the same label or context.
   * This powers the `recall://sessions/{session_id}/graph` resource.
   */
  async getSessionGraph(sessionId: string): Promise<SessionGraph> {
    const observations = await this.getSessionObservations(sessionId);
    const relations = this.inferRelations(observations);

    // Collect unique labels and contexts for metadata
    const labelsSet = new Set<string>();
    const contextsSet = new Set<string>();

    for (const obs of observations) {
      labelsSet.add(obs.label);
      if (obs.context) contextsSet.add(obs.context);
    }

    return {
      session_id: sessionId,
      observations,
      relations,
      metadata: {
        observation_count: observations.length,
        date_range: {
          earliest: observations[0]?.timestamp || '',
          latest: observations[observations.length - 1]?.timestamp || '',
        },
        labels: Array.from(labelsSet),
        contexts: Array.from(contextsSet),
      },
    };
  }

  /**
   * Infer relations between observations based on shared labels or context tags.
   * For each group of observations sharing the same label (or context),
   * creates edges connecting all pairs.
   */
  private inferRelations(observations: Observation[]): Relation[] {
    const relations: Relation[] = [];

    // Group by label
    const byLabel = new Map<string, Observation[]>();
    for (const obs of observations) {
      const group = byLabel.get(obs.label) || [];
      group.push(obs);
      byLabel.set(obs.label, group);
    }

    // Group by context (skip empty)
    const byContext = new Map<string, Observation[]>();
    for (const obs of observations) {
      if (!obs.context) continue;
      const group = byContext.get(obs.context) || [];
      group.push(obs);
      byContext.set(obs.context, group);
    }

    // Generate pairwise edges for label groups (2+ members)
    for (const [label, group] of byLabel) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          relations.push({
            source_id: group[i].id,
            target_id: group[j].id,
            type: 'same_label',
            value: label,
          });
        }
      }
    }

    // Generate pairwise edges for context groups (2+ members)
    for (const [context, group] of byContext) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          relations.push({
            source_id: group[i].id,
            target_id: group[j].id,
            type: 'same_context',
            value: context,
          });
        }
      }
    }

    return relations;
  }
}
