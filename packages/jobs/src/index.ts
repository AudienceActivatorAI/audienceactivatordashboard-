/**
 * Inngest Functions Export
 *
 * Export all Inngest job functions for registration with Inngest server
 */

export { inngest } from './client.js';
export { triggerCall } from './functions/trigger-call.js';
export { processTranscript } from './functions/process-transcript.js';
export { sendNotifications } from './functions/send-notifications.js';

// Export all functions as array for Inngest serve
import { triggerCall } from './functions/trigger-call.js';
import { processTranscript } from './functions/process-transcript.js';
import { sendNotifications } from './functions/send-notifications.js';

export const functions = [triggerCall, processTranscript, sendNotifications];
