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
  providers: [
    ObservationService,
    RecallTools,
    RecallResources,
    RecallPrompts,
  ],
  exports: [
    ObservationService,
    RecallTools,
    RecallResources,
    RecallPrompts,
  ],
})
export class RecallModule {}
