// ============================================================================
// Recall MCP Server — MCP Prompts
// ============================================================================
// Reusable prompt templates that pull observations from storage and format
// them into structured prompts for an AI model.
//
// Prompts:
//   1. study_summary     — produce a concise study summary from session observations
//   2. lab_report_draft  — turn session observations into a lab report skeleton
// ============================================================================

import { PromptDecorator as Prompt, ExecutionContext } from '@nitrostack/core';
import { ObservationService } from './observation.service.js';

export class RecallPrompts {
  constructor(private observationService: ObservationService) {}

  // ---------------------------------------------------------------------------
  // Prompt 1: Study Summary
  // ---------------------------------------------------------------------------

  @Prompt({
    name: 'study_summary',
    title: 'Study Summary',
    description:
      'Generate a concise study summary from a session\'s observations. ' +
      'Optionally filter by topic. The AI will organize observations into a ' +
      'clear, revision-friendly summary a student can study from.',
    arguments: [
      {
        name: 'session_id',
        description: 'The session to summarize observations from',
        required: true,
      },
      {
        name: 'topic',
        description:
          'Optional topic to filter observations (matches against label and context)',
        required: false,
      },
    ],
  })
  async getStudySummary(
    args: { session_id: string; topic?: string },
    ctx: ExecutionContext,
  ) {
    ctx.logger.info('Generating study summary prompt', {
      session: args.session_id,
      topic: args.topic || 'all',
    });

    // Fetch observations — filtered by topic if provided, otherwise all
    let observations;
    if (args.topic) {
      observations = await this.observationService.search(
        args.topic,
        args.session_id,
      );
    } else {
      observations = await this.observationService.getSessionObservations(
        args.session_id,
      );
    }

    // Format observations into a readable block
    const observationBlock =
      observations.length > 0
        ? observations
            .map(
              (obs, i) =>
                `${i + 1}. [${obs.label}] ${obs.note}` +
                (obs.context ? ` (context: ${obs.context})` : '') +
                ` — ${obs.timestamp}`,
            )
            .join('\n')
        : 'No observations found for this session/topic.';

    const topicClause = args.topic
      ? ` focusing on the topic "${args.topic}"`
      : '';

    return [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are a study assistant helping a student revise. Below are observations captured during session "${args.session_id}"${topicClause}.

## Captured Observations

${observationBlock}

## Your Task

Produce a **concise study summary** that:
1. Groups related observations by theme or subtopic
2. Highlights key concepts, procedures, and findings
3. Notes any important timing, quantities, or conditions mentioned
4. Flags anything that seems incomplete or needs follow-up
5. Is formatted for quick revision (use bullet points, bold key terms)

Keep the summary tight — this is for studying, not a full report.`,
        },
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Prompt 2: Lab Report Draft
  // ---------------------------------------------------------------------------

  @Prompt({
    name: 'lab_report_draft',
    title: 'Lab Report Draft',
    description:
      'Turn a session\'s observations into a structured lab report skeleton. ' +
      'Produces a draft with Objective, Method, Observations, and Conclusion ' +
      'sections that the student can then fill in and refine.',
    arguments: [
      {
        name: 'session_id',
        description: 'The session to generate a lab report from',
        required: true,
      },
    ],
  })
  async getLabReportDraft(
    args: { session_id: string },
    ctx: ExecutionContext,
  ) {
    ctx.logger.info('Generating lab report draft prompt', {
      session: args.session_id,
    });

    const observations = await this.observationService.getSessionObservations(
      args.session_id,
    );

    // Format observations chronologically
    const observationBlock =
      observations.length > 0
        ? observations
            .map(
              (obs, i) =>
                `${i + 1}. **${obs.label}**: ${obs.note}` +
                (obs.context ? ` [${obs.context}]` : '') +
                `\n   _Recorded: ${obs.timestamp}_`,
            )
            .join('\n\n')
        : 'No observations found for this session.';

    // Collect unique labels and contexts for additional structure
    const labels = [...new Set(observations.map((o) => o.label))];
    const contexts = [...new Set(observations.map((o) => o.context).filter(Boolean))];

    return [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are helping a student write a lab report. Below are all observations captured during session "${args.session_id}", listed chronologically.

## Raw Observations

${observationBlock}

## Session Metadata
- **Labels used**: ${labels.join(', ') || 'none'}
- **Context tags**: ${contexts.join(', ') || 'none'}
- **Total observations**: ${observations.length}
- **Time span**: ${observations[0]?.timestamp || 'N/A'} → ${observations[observations.length - 1]?.timestamp || 'N/A'}

## Your Task

Generate a **structured lab report skeleton** with these sections:

### 1. Objective
Infer the experiment's objective from the observations. Write 1–2 sentences.

### 2. Method
Reconstruct the procedure from the chronological observations. Use numbered steps.

### 3. Observations & Data
Organize the raw observations into a clean, tabular or bulleted format. Group by label or context where appropriate.

### 4. Analysis
Identify any patterns, anomalies, or relationships between observations.

### 5. Conclusion
Write placeholder conclusions based on what the observations suggest. Mark anything uncertain with [TODO].

### 6. Follow-up Questions
List 2–3 questions the student should investigate further.

Use markdown formatting. Mark any inferred or uncertain content with [INFERRED] or [TODO] tags.`,
        },
      },
    ];
  }
}
