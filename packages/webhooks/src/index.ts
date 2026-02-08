/**
 * Webhooks Server
 *
 * Fast webhook handlers using Hono framework for:
 * - Pixel event ingestion
 * - SignalWire voice callbacks
 * - SWAIG lifecycle events
 * - Conference status updates
 */

import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { cors } from 'hono/cors';
import { logger, config } from '@dealerbdc/shared';

// Import webhook handlers
import { pixelRouter } from './pixel/index.js';
import { signalwireRouter } from './signalwire/index.js';
import { swaigRouter } from './swaig/index.js';
import { csvRouter } from './csv/index.js';

const app = new Hono();
const PORT = config.webhooks.port;

// Middleware
app.use('*', honoLogger());
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'webhooks' });
});

// Mount routers
app.route('/webhooks/pixel', pixelRouter);
app.route('/webhooks/signalwire', signalwireRouter);
app.route('/webhooks/swaig', swaigRouter);
app.route('/webhooks/csv', csvRouter);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, 'Webhook error');
  return c.json(
    {
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

// Start server
console.log(`🚀 Webhooks server starting on port ${PORT}`);
console.log(`📡 Available endpoints:`);
console.log(`   POST http://localhost:${PORT}/webhooks/pixel`);
console.log(`   POST http://localhost:${PORT}/webhooks/signalwire/voice`);
console.log(`   POST http://localhost:${PORT}/webhooks/signalwire/status`);
console.log(`   POST http://localhost:${PORT}/webhooks/swaig/call-started`);
console.log(`   POST http://localhost:${PORT}/webhooks/swaig/call-ended`);
console.log(`   POST http://localhost:${PORT}/webhooks/csv/import`);
console.log(`   POST http://localhost:${PORT}/webhooks/csv/fetch-and-import`);
console.log(`   GET  http://localhost:${PORT}/webhooks/csv/imports/:importId`);

export default {
  port: PORT,
  fetch: app.fetch,
};
