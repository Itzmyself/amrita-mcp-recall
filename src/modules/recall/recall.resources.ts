// ============================================================================
// Recall MCP Server — MCP Resources
// ============================================================================
// Exposes read-only structured data via the MCP Resource primitive.
//
// Resource:
//   recall://sessions/{session_id}/graph
//   → Structured dump of all observations in a session with inferred relations.
//     Any MCP client can browse this directly without calling a tool.
// ============================================================================

import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';
import { ObservationService } from './observation.service.js';

export class RecallResources {
  constructor(private observationService: ObservationService) {}

  // ---------------------------------------------------------------------------
  // Resource: Session Observation Graph
  // ---------------------------------------------------------------------------

  @Resource({
    uri: 'recall://sessions/{session_id}/graph',
    name: 'Session Observation Graph',
    title: 'Session Graph',
    description:
      'Read-only structured dump of all observations in a session. ' +
      'Includes inferred relations between observations that share the same ' +
      'label or context tag. Useful for browsing session data without calling tools.',
    mimeType: 'application/json',
    annotations: {
      audience: ['user', 'assistant'],
      priority: 0.8,
    },
  })
  async getSessionGraph(uri: string, ctx: ExecutionContext) {
    // Extract session_id from the URI: recall://sessions/{session_id}/graph
    const match = uri.match(/recall:\/\/sessions\/([^/]+)\/graph/);
    if (!match) {
      throw new Error(`Invalid resource URI format: ${uri}`);
    }

    const sessionId = decodeURIComponent(match[1]);
    ctx.logger.info('Fetching session graph', { session_id: sessionId });

    const graph = await this.observationService.getSessionGraph(sessionId);

    // Return empty graph with helpful message if no observations found
    if (graph.observations.length === 0) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                session_id: sessionId,
                observations: [],
                relations: [],
                metadata: {
                  observation_count: 0,
                  date_range: { earliest: '', latest: '' },
                  labels: [],
                  contexts: [],
                },
                message: `No observations found for session "${sessionId}". Use the capture_observation tool to add observations.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(graph, null, 2),
        },
      ],
    };
  }
}
