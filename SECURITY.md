# Security Documentation

## Security Measures Implemented

This document outlines the security measures implemented in the Project 0 Music Server backend.

### 1. Path Traversal Protection

**Issue**: File streaming endpoints could be exploited to access files outside of the configured music directories.

**Fix**: 
- Implemented `isPathSafe()` function in `security.js` that validates file paths
- All file access through `/api/stream/:id` and `/api/cover/:id` now validates paths against `configData.musicDirectories`
- Paths are resolved to absolute form and checked to ensure they start with allowed directories

### 2. Input Validation

**Issue**: API endpoints accepted user input without validation, potentially allowing malicious data.

**Fix**:
- Added `express-validator` for comprehensive input validation
- Created validation middleware for all endpoints:
  - `searchValidation`: Validates search query parameters (max lengths, year range)
  - `playlistCreateValidation`: Validates playlist creation data
  - `playlistUpdateValidation`: Validates playlist update data
  - `playHistoryValidation`: Validates play duration
  - `historyLimitValidation`: Validates history limit parameter
  - `idValidation`: Validates ID parameters
- All validations enforce maximum lengths and appropriate data types

### 3. Rate Limiting

**Issue**: API endpoints were vulnerable to denial-of-service (DoS) attacks.

**Fix**:
- Implemented three-tier rate limiting using `express-rate-limit`:
  - **General API**: 1000 requests per 15 minutes per IP
  - **Write Operations** (playlists CRUD): 100 requests per 15 minutes per IP
  - **Scan Operations**: 5 requests per hour per IP
- Returns HTTP 429 (Too Many Requests) when limits are exceeded

### 4. Request Size Limits

**Issue**: Unlimited request body size could be exploited for DoS attacks.

**Fix**:
- Set JSON body parser limit to 1MB: `express.json({ limit: '1mb' })`
- Prevents memory exhaustion attacks via large payloads

### 5. Error Information Leakage

**Issue**: Error messages exposed internal implementation details and stack traces.

**Fix**:
- Implemented `sanitizeError()` function that:
  - In production: Returns generic error messages
  - In development: Returns error messages without stack traces
- All endpoints now use `sanitizeError()` instead of exposing raw error messages

### 6. Security Headers

**Issue**: Missing security headers left the application vulnerable to various attacks.

**Fix**:
- Added `helmet.js` middleware for comprehensive security headers
- Configured with appropriate settings for a media streaming application
- Headers include: X-DNS-Prefetch-Control, X-Frame-Options, X-Content-Type-Options, etc.

### 7. CORS Configuration

**Issue**: Unrestricted CORS policy allowed any origin to access the API.

**Fix**:
- Configurable CORS origin via `ALLOWED_ORIGINS` environment variable
- Defaults to wildcard (*) for development, but can be restricted in production
- Example: `ALLOWED_ORIGINS="https://example.com,https://app.example.com"`

### 8. Range Request Validation

**Issue**: HTTP range requests in streaming endpoint were not validated.

**Fix**:
- Added validation for range request parameters
- Checks for valid numeric values and appropriate bounds
- Returns HTTP 416 (Range Not Satisfiable) for invalid ranges

## Security Best Practices

### For Deployment

1. **Set Environment Variables** (REQUIRED in production):
   ```bash
   export NODE_ENV=production
   export ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
   ```
   
   **Important**: The server will fail to start in production mode without setting `ALLOWED_ORIGINS` to prevent accidental misconfigurations.

2. **File System Permissions**:
   - Music directories should have read-only access for the server process
   - Data directory should have read-write access for the server process only

3. **Network Configuration**:
   - Consider running behind a reverse proxy (nginx, Apache)
   - Use HTTPS in production
   - Configure firewall rules appropriately

4. **Regular Updates**:
   - Keep dependencies up to date
   - Run `npm audit` regularly to check for vulnerabilities
   - Monitor security advisories for used packages

### Known Limitations

1. **Authentication/Authorization**: 
   - Currently, there is no user authentication or authorization
   - All API endpoints are accessible to anyone who can reach the server
   - For production use, consider adding authentication middleware
   - Recommended: JWT tokens, OAuth2, or similar authentication mechanisms

2. **HTTPS**:
   - The server runs on HTTP by default
   - In production, use a reverse proxy (nginx/Apache) with HTTPS

3. **Music Directory Access**:
   - The server needs read access to music directories
   - Ensure proper file system permissions are set

## Vulnerability Disclosure

If you discover a security vulnerability, please email the maintainers directly rather than opening a public issue.

## Security Checklist for Deployment

- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` environment variable
- [ ] Set up HTTPS with reverse proxy
- [ ] Configure firewall rules
- [ ] Set proper file system permissions
- [ ] Review and restrict music directory access
- [ ] Enable logging and monitoring
- [ ] Regular security updates for dependencies
- [ ] Consider implementing authentication if needed
