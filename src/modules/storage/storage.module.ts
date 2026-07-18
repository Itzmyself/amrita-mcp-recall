import { Module } from '@nitrostack/core';
import { DatabaseService } from './database.service.js';

@Module({
  name: 'storage',
  description: 'SQLite storage layer for Recall observations',
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class StorageModule {}
