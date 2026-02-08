import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in monorepo root
dotenvConfig({ path: resolve(__dirname, '../../../..', '.env') });

/**
 * Application configuration schema
 * Validates and types environment variables
 */
export const configSchema = z.object({
  // Node environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase
  supabase: z.object({
    url: z.string().url().optional(),
    anonKey: z.string().optional(),
    serviceRoleKey: z.string().optional(),
  }).optional(),

  // Database
  database: z.object({
    url: z.string().optional(),
  }).optional(),

  // SignalWire
  signalwire: z.object({
    projectId: z.string(),
    apiToken: z.string(),
    spaceUrl: z.string(),
    aiAgentId: z.string().optional(),
  }),

  // Anthropic (Claude)
  anthropic: z.object({
    apiKey: z.string().optional(),
  }).optional(),

  // ElevenLabs
  elevenlabs: z.object({
    apiKey: z.string().optional(),
  }).optional(),

  // Inngest
  inngest: z.object({
    eventKey: z.string().optional(),
    signingKey: z.string().optional(),
  }).optional(),

  // OpenAI (for summaries)
  openai: z.object({
    apiKey: z.string().optional(),
  }).optional(),

  // Application ports
  api: z.object({
    port: z.coerce.number().default(3000),
  }),

  webhooks: z.object({
    port: z.coerce.number().default(3001),
    baseUrl: z.string().url(),
  }),

  signalwireTools: z.object({
    port: z.coerce.number().default(3002),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const rawConfig = {
    nodeEnv: process.env.NODE_ENV,
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    signalwire: {
      projectId: process.env.SIGNALWIRE_PROJECT_ID,
      apiToken: process.env.SIGNALWIRE_API_TOKEN,
      spaceUrl: process.env.SIGNALWIRE_SPACE_URL,
      aiAgentId: process.env.SIGNALWIRE_AI_AGENT_ID,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
    },
    inngest: {
      eventKey: process.env.INNGEST_EVENT_KEY,
      signingKey: process.env.INNGEST_SIGNING_KEY,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    api: {
      port: process.env.API_PORT,
    },
    webhooks: {
      port: process.env.WEBHOOKS_PORT,
      baseUrl: process.env.WEBHOOK_BASE_URL,
    },
    signalwireTools: {
      port: process.env.SIGNALWIRE_TOOLS_PORT,
    },
    logging: {
      level: process.env.LOG_LEVEL,
    },
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Configuration validation failed');
    }
    throw error;
  }
}

// Singleton config instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// Default export for convenience
export const config = getConfig();
