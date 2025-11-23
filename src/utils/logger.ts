/**
 * Simple console-based logger with color-coded output
 */

import { config } from '../config.js';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
};

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
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
     */
    private log(level: LogLevel, levelName: string, color: string, message: string, ...args: any[]): void {
        if (level < this.minLevel) return;

        const timestamp = this.getTimestamp();
        const prefix = `${colors.gray}${timestamp}${colors.reset} ${color}[${levelName}]${colors.reset}`;

        console.log(prefix, message, ...args);
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
