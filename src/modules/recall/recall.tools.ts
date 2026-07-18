// ============================================================================
// Recall MCP Server — MCP Tools
// ============================================================================
// Implements all 5 MCP tools for the Recall memory agent:
//   1. capture_observation  — store a new observation
//   2. recall               — search stored observations
//   3. update_observation   — edit an existing observation's note
//   4. delete_observation   — soft-delete an observation
//   5. list_sessions        — list all sessions with counts
//
// Each tool uses Zod schemas (via NitroStack's `z`) for input validation
// and includes behavioral annotations for MCP client hints.
// ============================================================================

import { ToolDecorator as Tool, z, ExecutionContext } from '@nitrostack/core';
import { ObservationService } from './observation.service.js';

export class RecallTools {
  constructor(private observationService: ObservationService) {}

  // ---------------------------------------------------------------------------
  // Tool 1: capture_observation
  // ---------------------------------------------------------------------------

  @Tool({
    name: 'capture_observation',
    title: 'Capture Observation',
    description:
      'Store a new narrated observation from a lab, lecture, or fieldwork session. ' +
      'Returns the stored record ID and timestamp.',
    inputSchema: z.object({
      label: z
        .string()
        .min(1)
        .describe('Short descriptive label (e.g. "titration setup", "pH reading")'),
      note: z
        .string()
        .min(1)
        .describe('The narrated observation text'),
      context: z
        .string()
        .optional()
        .default('')
        .describe('Optional context tag (e.g. "experiment-3", "chapter-5")'),
      session_id: z
        .string()
        .min(1)
        .describe('Session identifier grouping related observations'),
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  })
  async captureObservation(
    input: { label: string; note: string; context?: string; session_id: string },
    ctx: ExecutionContext,
  ) {
    ctx.logger.info('Capturing observation', {
      label: input.label,
      session: input.session_id,
    });

    const observation = await this.observationService.create(
      input.label,
      input.note,
      input.context || '',
      input.session_id,
    );

    return {
      id: observation.id,
      timestamp: observation.timestamp,
      message: `Observation captured: "${input.label}"`,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool 2: recall
  // ---------------------------------------------------------------------------

  @Tool({
    name: 'recall',
    title: 'Recall Observations',
    description:
      'Search stored observations by keyword across label, note, and context fields. ' +
      'Optionally scope the search to a specific session. Returns matching records ' +
      'with label, note, context, and timestamp.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('Search keyword or phrase to match against observations'),
      session_id: z
        .string()
        .optional()
        .describe('Optional session ID to scope the search to a single session'),
    }),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  })
  async recall(
    input: { query: string; session_id?: string },
    ctx: ExecutionContext,
  ) {
    ctx.logger.info('Recalling observations', {
      query: input.query,
      session: input.session_id || 'all',
    });

    const results = await this.observationService.search(
      input.query,
      input.session_id,
    );

    return {
      count: results.length,
      results: results.map((obs) => ({
        id: obs.id,
        session_id: obs.session_id,
        label: obs.label,
        note: obs.note,
        context: obs.context,
        timestamp: obs.timestamp,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Tool 3: update_observation
  // ---------------------------------------------------------------------------

  @Tool({
    name: 'update_observation',
    title: 'Update Observation',
    description:
      'Correct or update the note text of an existing observation. ' +
      'Returns the updated record.',
    inputSchema: z.object({
      id: z.string().min(1).describe('ID of the observation to update'),
      new_note: z.string().min(1).describe('Updated note text'),
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  })
  async updateObservation(
    input: { id: string; new_note: string },
    ctx: ExecutionContext,
  ) {
    ctx.logger.info('Updating observation', { id: input.id });

    const updated = await this.observationService.update(input.id, input.new_note);

    if (!updated) {
      return {
        success: false,
        error: `Observation not found: ${input.id}`,
      };
    }

    return {
      success: true,
      observation: {
        id: updated.id,
        session_id: updated.session_id,
        label: updated.label,
        note: updated.note,
        context: updated.context,
        timestamp: updated.timestamp,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Tool 4: delete_observation
  // ---------------------------------------------------------------------------

  @Tool({
    name: 'delete_observation',
    title: 'Delete Observation',
    description:
      'Soft-delete an observation by ID. The record is flagged as deleted ' +
      'but not physically removed from storage.',
    inputSchema: z.object({
      id: z.string().min(1).describe('ID of the observation to delete'),
    }),
    annotations: {
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  })
  async deleteObservation(
    input: { id: string },
    ctx: ExecutionContext,
  ) {
    ctx.logger.info('Deleting observation', { id: input.id });

    const deleted = await this.observationService.softDelete(input.id);

    return {
      success: deleted,
      id: input.id,
      message: deleted
        ? 'Observation soft-deleted successfully'
        : `Observation not found or already deleted: ${input.id}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool 5: list_sessions
  // ---------------------------------------------------------------------------

  @Tool({
    name: 'list_sessions',
    title: 'List Sessions',
    description:
      'List all observation sessions with their observation counts and date ranges. ' +
      'Useful for browsing what sessions are available before recalling specific observations.',
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  })
  async listSessions(
    _input: Record<string, never>,
    ctx: ExecutionContext,
  ) {
    ctx.logger.info('Listing all sessions');

    const sessions = await this.observationService.listSessions();

    return {
      count: sessions.length,
      sessions: sessions.map((s) => ({
        session_id: s.session_id,
        observation_count: s.observation_count,
        first_observation: s.first_observation,
        last_observation: s.last_observation,
      })),
    };
  }
}
