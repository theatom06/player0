import { body, query, param, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs';

/**
 * Middleware to validate request inputs and return errors
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input', details: errors.array() });
  }
  next();
};

/**
 * Validates that a file path is safe and within allowed directories
 * @param {string} filePath - The file path to validate
 * @param {string[]} allowedDirs - Array of allowed base directories
 * @returns {boolean} - True if path is safe
 */
export function isPathSafe(filePath, allowedDirs) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  // Resolve the path to its absolute form
  const resolvedPath = path.resolve(filePath);
  
  // Check if the resolved path starts with any of the allowed directories
  return allowedDirs.some(allowedDir => {
    const resolvedAllowedDir = path.resolve(allowedDir);
    // Ensure the allowed directory ends with a path separator to prevent bypass
    const normalizedAllowedDir = resolvedAllowedDir.endsWith(path.sep) 
      ? resolvedAllowedDir 
      : resolvedAllowedDir + path.sep;
    
    // Check if path is exactly the allowed dir or within it
    return resolvedPath === resolvedAllowedDir || 
           resolvedPath.startsWith(normalizedAllowedDir);
  });
}

/**
 * Validates that a file exists and is accessible
 * @param {string} filePath - The file path to check
 * @returns {boolean} - True if file exists
 */
export function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Validation rules for search endpoint
 */
export const searchValidation = [
  query('q').optional().isString().trim().isLength({ max: 200 }),
  query('artist').optional().isString().trim().isLength({ max: 200 }),
  query('album').optional().isString().trim().isLength({ max: 200 }),
  query('genre').optional().isString().trim().isLength({ max: 100 }),
  query('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 10 }),
  validate
];

/**
 * Validation rules for playlist creation
 */
export const playlistCreateValidation = [
  body('name').isString().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 1000 }),
  validate
];

/**
 * Validation rules for playlist update
 */
export const playlistUpdateValidation = [
  body('name').optional().isString().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 1000 }),
  body('songs').optional().isArray(),
  validate
];

/**
 * Validation rules for play history
 */
export const playHistoryValidation = [
  body('durationPlayed').optional().isInt({ min: 0, max: 172800 }), // Max 48 hours for long audio files
  validate
];

/**
 * Validation rules for history limit
 */
export const historyLimitValidation = [
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validate
];

/**
 * Validation rules for ID parameters
 */
export const idValidation = [
  param('id').isString().trim().notEmpty().isLength({ max: 100 }),
  validate
];

/**
 * Sanitize error messages to prevent information leakage
 * @param {Error|any} error - The error object
 * @returns {string} - Sanitized error message
 */
export function sanitizeError(error) {
  // Handle cases where error might not be an Error object
  if (!error) {
    return 'An error occurred';
  }
  
  if (process.env.NODE_ENV === 'production') {
    // In production, don't expose internal error details
    return 'An internal error occurred';
  }
  
  // In development, show the error message but not the stack trace
  if (error instanceof Error) {
    return error.message || 'An error occurred';
  }
  
  // Handle non-Error objects
  return String(error);
}
