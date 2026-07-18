// ============================================================================
// Recall MCP Server — Recall Feature Module
// ============================================================================
// Registers all Recall MCP primitives (tools, resources, prompts) and
// the ObservationService business logic provider.
// ============================================================================

import { Module } from '@nitrostack/core';
import { StorageModule } from '../storage/storage.module.js';
import { RecallTools } from './recall.tools.js';
import { RecallResources } from './recall.resources.js';
import { RecallPrompts } from './recall.prompts.js';
import { ObservationService } from './observation.service.js';

@Module({
  name: 'recall',
  description: 'Memory agent for capturing and recalling student observations',
  imports: [StorageModule],
  controllers: [RecallTools, RecallResources, RecallPrompts],
  providers: [ObservationService],
  exports: [ObservationService],
})
export class RecallModule {}
