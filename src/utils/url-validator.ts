/**
 * URL validation utilities for secure downloads
 *
 * Provides security validation for URLs to prevent:
 * - SSRF (Server-Side Request Forgery) attacks
 * - Downloads from unauthorized domains
 * - Malformed or dangerous URLs
 *
 * Per S-1: Security hardening for external resource access
 */

import { logger } from './logger.js';

/**
 * Allowed domains for image downloads
 * Only Discord CDN domains are trusted sources
 */
const ALLOWED_IMAGE_DOMAINS = [
  'cdn.discordapp.com',
  'media.discordapp.net',
  'images-ext-1.discordapp.net',
  'images-ext-2.discordapp.net',
] as const;

/**
 * Blocked IP patterns (SSRF protection)
 * Prevents requests to internal/private networks
 * Per Issue #4: Includes comprehensive IPv6 patterns
 */
const BLOCKED_IP_PATTERNS = [
  // Localhost
  /^127\./,
  /^localhost$/i,
  // Private networks (RFC 1918)
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  // Link-local
  /^169\.254\./,
  // Loopback IPv6
  /^::1$/,
  /^0:0:0:0:0:0:0:1$/,
  // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  /^::ffff:127\./i,
  /^::ffff:10\./i,
  /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./i,
  /^::ffff:192\.168\./i,
  /^::ffff:169\.254\./i,
  // IPv6 link-local (fe80::/10)
  /^fe80:/i,
  // IPv6 unique local addresses (fc00::/7 = fc00:: and fd00::)
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  // Cloud metadata endpoints
  /^169\.254\.169\.254$/,
  /^metadata\./i,
] as const;

/**
 * Result of URL validation
 */
export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Validate a URL for image downloads
 *
 * Checks:
 * 1. Valid URL format
 * 2. HTTPS protocol (required)
 * 3. Allowed domain (Discord CDN only)
 * 4. No internal/private IP addresses (SSRF protection)
 *
 * @param url - The URL to validate
 * @returns Validation result with normalized URL or error
 *
 * @example
 * ```typescript
 * const result = validateImageUrl('https://cdn.discordapp.com/attachments/...');
 * if (result.valid) {
 *   const response = await fetch(result.normalizedUrl!);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateImageUrl(url: string): UrlValidationResult {
  // Trim and basic sanitization
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Require HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' };
  }

  // Check hostname against allowed domains
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    !ALLOWED_IMAGE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  ) {
    logger.warn(`Blocked image download from unauthorized domain: ${hostname}`);
    return {
      valid: false,
      error: 'Image must be from Discord CDN. Please upload the image directly to Discord.',
    };
  }

  // Check for blocked IP patterns (SSRF protection)
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      logger.warn(`Blocked potential SSRF attempt: ${hostname}`);
      return { valid: false, error: 'Invalid URL: internal addresses are not allowed' };
    }
  }

  // Ensure no auth credentials in URL
  if (parsedUrl.username || parsedUrl.password) {
    return { valid: false, error: 'URLs with credentials are not allowed' };
  }

  // Return normalized URL
  return {
    valid: true,
    normalizedUrl: parsedUrl.toString(),
  };
}

/**
 * Validate a general URL (not restricted to image domains)
 *
 * Less restrictive than validateImageUrl, but still:
 * - Requires HTTPS
 * - Blocks internal/private IPs
 * - Blocks credentials in URL
 *
 * @param url - The URL to validate
 * @returns Validation result
 */
export function validateExternalUrl(url: string): UrlValidationResult {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Require HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' };
  }

  // Check for blocked IP patterns (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      logger.warn(`Blocked potential SSRF attempt: ${hostname}`);
      return { valid: false, error: 'Invalid URL: internal addresses are not allowed' };
    }
  }

  // Ensure no auth credentials in URL
  if (parsedUrl.username || parsedUrl.password) {
    return { valid: false, error: 'URLs with credentials are not allowed' };
  }

  return {
    valid: true,
    normalizedUrl: parsedUrl.toString(),
  };
}

/**
 * Check if a URL is from Discord CDN
 *
 * @param url - The URL to check
 * @returns True if the URL is from a Discord CDN domain
 */
export function isDiscordCdnUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return ALLOWED_IMAGE_DOMAINS.some((domain) => hostname === domain);
  } catch {
    return false;
  }
}

/**
 * Get the list of allowed image domains (for error messages)
 */
export function getAllowedImageDomains(): readonly string[] {
  return ALLOWED_IMAGE_DOMAINS;
}
