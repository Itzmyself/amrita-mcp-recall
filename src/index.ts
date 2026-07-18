// ============================================================================
// Recall MCP Server — Entry Point
// ============================================================================
// Bootstraps the NitroStack MCP application and starts listening.
// Run with: npx @nitrostack/cli dev (development)
//           node dist/index.js       (production)
// ============================================================================

import { McpApplicationFactory } from '@nitrostack/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const server = await McpApplicationFactory.create(AppModule);
  await server.start();
}

bootstrap();
