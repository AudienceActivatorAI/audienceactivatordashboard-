/**
 * SWAIG Function Server
 *
 * This server exposes tool functions that the SignalWire AI agent can call
 * during conversations with leads. Each function is a POST endpoint that
 * receives parameters from SWAIG and returns structured results.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { config, logger } from '@dealerbdc/shared';

// Import SWAIG function handlers
import { lookupLead } from './tools/lookup-lead.js';
import { getRoutingRules } from './tools/get-routing-rules.js';
import { initiateTransfer } from './tools/initiate-transfer.js';
import { logQualification } from './tools/log-qualification.js';

const app = express();
const PORT = config.signalwireTools.port;

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      body: req.body,
    }, 'SWAIG function request');
  });

  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'signalwire-tools' });
});

// SWAIG function endpoints
app.post('/swaig/lookup-lead', lookupLead);
app.post('/swaig/get-routing-rules', getRoutingRules);
app.post('/swaig/initiate-transfer', initiateTransfer);
app.post('/swaig/log-qualification', logQualification);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path }, 'SWAIG function error');

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'SWAIG function server started');
  console.log(`🚀 SWAIG function server listening on port ${PORT}`);
  console.log(`📡 Available functions:`);
  console.log(`   POST http://localhost:${PORT}/swaig/lookup-lead`);
  console.log(`   POST http://localhost:${PORT}/swaig/get-routing-rules`);
  console.log(`   POST http://localhost:${PORT}/swaig/initiate-transfer`);
  console.log(`   POST http://localhost:${PORT}/swaig/log-qualification`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
