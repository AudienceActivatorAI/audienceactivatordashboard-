import pino from 'pino';

// Create logger instance with sensible defaults
export const createLogger = (options?: {
  name?: string;
  level?: string;
  prettyPrint?: boolean;
}) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const logLevel = options?.level || process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

  return pino({
    name: options?.name || 'dealerbdc',
    level: logLevel,
    transport:
      options?.prettyPrint ?? isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              ignore: 'pid,hostname',
              translateTime: 'HH:MM:ss.l',
            },
          }
        : undefined,
    // Include trace ID for request correlation
    mixin() {
      return {
        trace_id: global.traceId || undefined,
      };
    },
  });
};

// Default logger instance
export const logger = createLogger();

// Create child logger with additional context
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

// Type for logger
export type Logger = ReturnType<typeof createLogger>;
