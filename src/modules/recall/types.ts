// ============================================================================
// Recall MCP Server — Type Definitions
// ============================================================================
// Core data types used across tools, resources, prompts, and the storage layer.
// Kept in a single file for clarity and easy maintenance.
// ============================================================================

/**
 * A single observation captured during a lab, lecture, or fieldwork session.
 * This is the fundamental unit of memory in Recall.
 */
export interface Observation {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Groups observations into a logical session (e.g. "chem-lab-2026-07-18") */
  session_id: string;

  /** Short descriptive label (e.g. "titration setup", "pH reading") */
  label: string;

  /** The narrated observation text */
  note: string;

  /** Optional context tag (e.g. "experiment-3", "chapter-5") */
  context: string;

  /** ISO 8601 timestamp of when the observation was captured */
  timestamp: string;

  /** Soft-delete flag: 0 = active, 1 = deleted */
  deleted: number;
}

/**
 * Summary of a session returned by the `list_sessions` tool.
 */
export interface SessionSummary {
  session_id: string;
  observation_count: number;
  first_observation: string;
  last_observation: string;
}

/**
 * An inferred relation between two observations in the same session.
 * Relations are computed on read (not stored) based on shared labels or context tags.
 */
export interface Relation {
  /** ID of the source observation */
  source_id: string;

  /** ID of the target observation */
  target_id: string;

  /** How the relation was inferred */
  type: 'same_label' | 'same_context';

  /** The shared value (the label string or context tag) */
  value: string;
}

/**
 * A structured graph of all observations in a session, including inferred relations.
 * Returned by the `recall://sessions/{session_id}/graph` resource.
 */
export interface SessionGraph {
  session_id: string;
  observations: Observation[];
  relations: Relation[];
  metadata: {
    observation_count: number;
    date_range: {
      earliest: string;
      latest: string;
    };
    labels: string[];
    contexts: string[];
  };
}
