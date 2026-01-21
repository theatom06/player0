/**
 * ============================================
 * Logger Module
 * ============================================
 * 
 * Structured logging utility for the Player 0 backend.
 * Provides different log levels and optional file logging.
 * 
 * Features:
 * - Colored console output
 * - Timestamp formatting
 * - Request ID tracking
 * - Log level filtering
 * - Optional file output
 * 
 * @module logger
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels with colors
const LOG_LEVELS = {
  error: { priority: 0, color: '\x1b[31m', label: 'ERROR' },
  warn: { priority: 1, color: '\x1b[33m', label: 'WARN' },
  info: { priority: 2, color: '\x1b[36m', label: 'INFO' },
  http: { priority: 3, color: '\x1b[35m', label: 'HTTP' },
  debug: { priority: 4, color: '\x1b[90m', label: 'DEBUG' }
};

const RESET_COLOR = '\x1b[0m';

class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'http';
    this.logToFile = options.logToFile || process.env.LOG_TO_FILE === 'true';
    this.logDir = options.logDir || path.join(__dirname, 'logs');
    this.logFile = null;
    
    if (this.logToFile) {
      this.initFileLogging();
    }
  }

  initFileLogging() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      const date = new Date().toISOString().split('T')[0];
      this.logFile = path.join(this.logDir, `player0-${date}.log`);
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
    }
  }

  shouldLog(level) {
    const currentPriority = LOG_LEVELS[this.level]?.priority ?? 3;
    const messagePriority = LOG_LEVELS[level]?.priority ?? 2;
    return messagePriority <= currentPriority;
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = this.formatTimestamp();
    const levelInfo = LOG_LEVELS[level] || LOG_LEVELS.info;
    
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ' ' + JSON.stringify(meta);
    }
    
    return {
      console: `${levelInfo.color}[${timestamp}] [${levelInfo.label}]${RESET_COLOR} ${message}${metaStr}`,
      file: `[${timestamp}] [${levelInfo.label}] ${message}${metaStr}`
    };
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;
    
    const formatted = this.formatMessage(level, message, meta);
    console.log(formatted.console);
    
    if (this.logToFile && this.logFile) {
      try {
        fs.appendFileSync(this.logFile, formatted.file + '\n');
      } catch (error) {
        // Silently fail file logging
      }
    }
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  http(message, meta = {}) {
    this.log('http', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }
}

// Create singleton instance
const logger = new Logger();

/**
 * Express middleware for HTTP request logging
 * Logs method, URL, status code, and response time
 */
export function httpLogger(req, res, next) {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  // Attach request ID for tracking
  req.requestId = requestId;
  
  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : res.statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
    
    logger.http(`${req.method} ${req.originalUrl} ${statusColor}${res.statusCode}${RESET_COLOR} ${duration}ms`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip || req.connection?.remoteAddress
    });
  });
  
  next();
}

/**
 * Simple in-memory rate limiter
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds (default: 1 minute)
 * @param {number} options.max - Max requests per window (default: 100)
 * @param {string} options.message - Error message (default: 'Too many requests')
 */
export function rateLimiter(options = {}) {
  const getOptions = (typeof options === 'function') ? options : () => options;
  
  const requests = new Map();
  
  // Cleanup old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requests.entries()) {
      if (now - data.windowStart > (data.windowMs || 60 * 1000)) {
        requests.delete(key);
      }
    }
  }, 60 * 1000);
  
  return (req, res, next) => {
    const opts = getOptions() || {};
    const enabled = (typeof opts.enabled === 'boolean') ? opts.enabled : true;
    const windowMs = Number(opts.windowMs) || 60 * 1000;
    const max = Number(opts.max) || 100;
    const message = opts.message || 'Too many requests, please try again later';

    if (!enabled) return next();

    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    
    let data = requests.get(key);
    
    if (!data || now - data.windowStart > windowMs) {
      data = { count: 1, windowStart: now, windowMs };
      requests.set(key, data);
    } else {
      data.count++;
      data.windowMs = windowMs;
    }
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - data.count));
    res.setHeader('X-RateLimit-Reset', new Date(data.windowStart + windowMs).toISOString());
    
    if (data.count > max) {
      logger.warn(`Rate limit exceeded for ${key}`, { ip: key, count: data.count });
      return res.status(429).json({ error: message });
    }
    
    next();
  };
}

export default logger;
