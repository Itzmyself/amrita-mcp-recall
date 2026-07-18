import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { StorageModule } from './modules/storage/storage.module.js';
import { RecallModule } from './modules/recall/recall.module.js';

@McpApp({
  module: AppModule,
  server: {
    name: 'recall-mcp',
    version: '1.0.0',
  },
  logging: {
    level: 'info',
  },
})
@Module({
  name: 'app',
  description: 'Root application module for Recall MCP server',
  imports: [
    ConfigModule.forRoot(),
    StorageModule,
    RecallModule,
  ],
})
export class AppModule {}
