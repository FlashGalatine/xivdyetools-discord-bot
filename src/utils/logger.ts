/**
 * Simple console-based logger with color-coded output
 * Per S-5: Secret redaction to prevent credential leaks
 */

import { config } from '../config.js';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

/**
 * Sensitive keys that should be redacted from logs
 * Per S-5: Secret redaction
 */
const SENSITIVE_KEYS = ['token', 'password', 'secret', 'key', 'webhook', 'auth', 'credential'];

/**
 * Redact sensitive information from objects
 * Per S-5: Recursive object traversal, redacts sensitive keys
 */
export function redactSensitive<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => redactSensitive(item)) as T;
    }

    // Handle objects
    const redacted = { ...obj } as Record<string, unknown>;
    for (const key of Object.keys(redacted)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key contains any sensitive keyword
        if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
            redacted[key] = '[REDACTED]';
        } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
            // Recursively redact nested objects
            redacted[key] = redactSensitive(redacted[key]);
        }
    }

    return redacted as T;
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
};

// Per Issue #9: Only use ANSI colors when output is a TTY
const isTTY = process.stdout.isTTY ?? false;

// ANSI color codes (empty strings when not a TTY to avoid log aggregation issues)
const colors = {
    reset: isTTY ? '\x1b[0m' : '',
    bright: isTTY ? '\x1b[1m' : '',
    dim: isTTY ? '\x1b[2m' : '',
    red: isTTY ? '\x1b[31m' : '',
    green: isTTY ? '\x1b[32m' : '',
    yellow: isTTY ? '\x1b[33m' : '',
    blue: isTTY ? '\x1b[34m' : '',
    magenta: isTTY ? '\x1b[35m' : '',
    cyan: isTTY ? '\x1b[36m' : '',
    white: isTTY ? '\x1b[37m' : '',
    gray: isTTY ? '\x1b[90m' : '',
};

class Logger {
    private minLevel: LogLevel;

    constructor() {
        this.minLevel = LOG_LEVEL_MAP[config.logLevel] ?? LogLevel.INFO;
    }

    /**
     * Format timestamp
     */
    private getTimestamp(): string {
        const now = new Date();
        return now.toISOString();
    }

    /**
     * Log message if level is sufficient
     * Per S-5: Automatically redacts sensitive information
     */
    private log(level: LogLevel, levelName: string, color: string, message: string, ...args: any[]): void {
        if (level < this.minLevel) return;

        const timestamp = this.getTimestamp();
        const prefix = `${colors.gray}${timestamp}${colors.reset} ${color}[${levelName}]${colors.reset}`;

        // Redact sensitive information from args
        const redactedArgs = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                return redactSensitive(arg);
            }
            return arg;
        });

        console.log(prefix, message, ...redactedArgs);
    }

    /**
     * Debug level logging
     */
    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, 'DEBUG', colors.cyan, message, ...args);
    }

    /**
     * Info level logging
     */
    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, 'INFO', colors.green, message, ...args);
    }

    /**
     * Warning level logging
     */
    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, 'WARN', colors.yellow, message, ...args);
    }

    /**
     * Error level logging
     */
    error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, 'ERROR', colors.red, message, ...args);
    }
}

// Export singleton logger instance
export const logger = new Logger();
