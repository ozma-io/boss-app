/**
 * Centralized Logging Service
 * 
 * Provides structured logging with consistent formatting across the application.
 * Follows industry best practices for application logging.
 * 
 * Benefits:
 * - Structured logs with automatic context
 * - Environment-aware log level filtering
 * - Sentry integration with graceful fallback
 * - Performance measurement utilities
 * - User context tracking
 * 
 * Usage:
 * ```typescript
 * import { logger } from '@/services/logger.service';
 * 
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Failed to fetch data', { error, feature: 'DataService' });
 * logger.warn('SDK not available', { error: String(error), feature: 'SDK' });
 * logger.time('fetchData');
 * // ... code ...
 * logger.timeEnd('fetchData'); // Logs: "fetchData completed in 123ms"
 * ```
 */

// Sentry import with try-catch protection
let Sentry: any = null;
try {
  Sentry = require('@sentry/react-native');
} catch (error) {
  // Sentry not available, will fall back to console logging only
  console.error('Sentry SDK not available, using console logging only');
}

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Additional context to enrich logs
 */
export interface LogContext {
  feature?: string;
  action?: string;
  userId?: string;
  userEmail?: string;
  duration?: number;
  [key: string]: any;
}

/**
 * Timer storage for performance measurements
 */
interface Timer {
  startTime: number;
  label: string;
}

/**
 * Logger Service Class
 */
class LoggerService {
  private minLogLevel: LogLevel;
  private globalContext: LogContext = {};
  private timers: Map<string, Timer> = new Map();
  private isInitialized = false;
  private isSentryAvailable = false;

  constructor() {
    this.minLogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;
  }

  /**
   * Initialize logger with Sentry integration
   */
  init(options?: { minLevel?: LogLevel }): void {
    if (this.isInitialized) {
      return;
    }

    if (options?.minLevel !== undefined) {
      this.minLogLevel = options.minLevel;
    }

    // Initialize Sentry with graceful fallback
    if (Sentry) {
      try {
        const { getSentryOptions } = require('@/constants/sentry.config');
        const sentryOptions = getSentryOptions(__DEV__);
        Sentry.init(sentryOptions);
        this.isSentryAvailable = true;
        console.log('Sentry initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Sentry, falling back to console logging:', error);
        this.isSentryAvailable = false;
      }
    }

    this.isInitialized = true;
    this.log(LogLevel.INFO, 'Logger initialized', { 
      minLevel: LogLevel[this.minLogLevel],
      sentryEnabled: this.isSentryAvailable 
    });
  }

  /**
   * Set global context that will be included in all logs
   */
  setContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  /**
   * Clear global context
   */
  clearContext(): void {
    this.globalContext = {};
  }

  /**
   * Set user context for tracking
   */
  setUserContext(userId: string, email?: string): void {
    this.setContext({ userId, userEmail: email });
    
    // Set user context in Sentry with graceful fallback
    if (this.isSentryAvailable && Sentry) {
      try {
        Sentry.setUser({ id: userId, email });
      } catch (error) {
        console.error('Failed to set Sentry user context:', error);
      }
    }
  }

  /**
   * Clear user context (on logout)
   */
  clearUserContext(): void {
    const { userId, userEmail, ...rest } = this.globalContext;
    this.globalContext = rest;
    
    // Clear user context in Sentry with graceful fallback
    if (this.isSentryAvailable && Sentry) {
      try {
        Sentry.setUser(null);
      } catch (error) {
        console.error('Failed to clear Sentry user context:', error);
      }
    }
  }

  /**
   * Start a performance timer
   */
  time(label: string): void {
    this.timers.set(label, {
      startTime: Date.now(),
      label,
    });
  }

  /**
   * End a performance timer and log the duration
   */
  timeEnd(label: string, context?: LogContext): void {
    const timer = this.timers.get(label);
    if (!timer) {
      this.warn(`Timer "${label}" does not exist`, context);
      return;
    }

    const duration = Date.now() - timer.startTime;
    this.timers.delete(label);
    
    this.debug(`${label} completed`, { ...context, duration });
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   * 
   * For errors with Error objects, include them in context:
   * logger.error('Failed to fetch', { error, feature: 'API' })
   */
  error(message: string, context?: LogContext): void {
    const errorContext = this.enrichErrorContext(context?.error, context);
    this.log(LogLevel.ERROR, message, errorContext);

    // Send to Sentry with graceful fallback
    if (this.isSentryAvailable && Sentry && context?.error) {
      try {
        const errorToCapture = context.error instanceof Error 
          ? context.error 
          : new Error(String(context.error));
        
        Sentry.captureException(errorToCapture, {
          level: 'error',
          tags: { feature: context?.feature || 'unknown' },
          extra: errorContext,
        });
      } catch (sentryError) {
        console.error('Failed to send error to Sentry:', sentryError);
      }
    }
  }

  /**
   * Log a fatal error (critical errors requiring immediate attention)
   * 
   * For errors with Error objects, include them in context:
   * logger.fatal('Critical failure', { error, feature: 'Database' })
   */
  fatal(message: string, context?: LogContext): void {
    const errorContext = this.enrichErrorContext(context?.error, context);
    this.log(LogLevel.FATAL, message, errorContext);

    // Send to Sentry with high priority and graceful fallback
    if (this.isSentryAvailable && Sentry && context?.error) {
      try {
        const errorToCapture = context.error instanceof Error 
          ? context.error 
          : new Error(String(context.error));
        
        Sentry.captureException(errorToCapture, {
          level: 'fatal',
          tags: { 
            feature: context?.feature || 'unknown',
            severity: 'critical' 
          },
          extra: errorContext,
        });
      } catch (sentryError) {
        console.error('Failed to send fatal error to Sentry:', sentryError);
      }
    }
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Filter logs based on minimum log level
    if (level < this.minLogLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const mergedContext = { ...this.globalContext, ...context };

    // Format the log message
    const formattedMessage = this.formatMessage(timestamp, levelName, message, mergedContext);

    // Output to console
    this.outputToConsole(level, formattedMessage, mergedContext);
  }

  /**
   * Format log message with timestamp and level
   */
  private formatMessage(
    timestamp: string,
    level: string,
    message: string,
    context: LogContext
  ): string {
    const feature = context.feature ? `[${context.feature}]` : '';
    return `${timestamp} ${level} ${feature} ${message}`.trim();
  }

  /**
   * Output log to console
   */
  private outputToConsole(level: LogLevel, message: string, context: LogContext): void {
    const contextString = Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '';

    switch (level) {
      case LogLevel.DEBUG:
        console.log(message, contextString);
        break;
      case LogLevel.INFO:
        console.log(message, contextString);
        break;
      case LogLevel.WARN:
        console.warn(message, contextString);
        break;
      case LogLevel.ERROR:
        console.error(message, contextString);
        break;
      case LogLevel.FATAL:
        console.error(`🚨 FATAL: ${message}`, contextString);
        break;
    }
  }

  /**
   * Enrich context with error details
   */
  private enrichErrorContext(error: Error | unknown, context?: LogContext): LogContext {
    const enriched = { ...context };

    if (error instanceof Error) {
      enriched.errorMessage = error.message;
      enriched.errorName = error.name;
      enriched.errorStack = error.stack;
    } else if (error) {
      enriched.error = String(error);
    }

    return enriched;
  }
}

// Export singleton instance
export const logger = new LoggerService();

// Auto-initialize with defaults
logger.init();

