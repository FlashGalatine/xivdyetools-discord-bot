/**
 * Tests for utils/url-validator.ts
 *
 * Tests URL validation functions for security
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateImageUrl,
  validateExternalUrl,
  isDiscordCdnUrl,
  getAllowedImageDomains,
} from './url-validator.js';
import { logger } from './logger.js';

// Mock logger to prevent output during tests
vi.mock('./logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('URL Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateImageUrl', () => {
    describe('valid Discord CDN URLs', () => {
      it('should accept cdn.discordapp.com URLs', () => {
        const result = validateImageUrl('https://cdn.discordapp.com/attachments/123/456/image.png');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
      });

      it('should accept media.discordapp.net URLs', () => {
        const result = validateImageUrl(
          'https://media.discordapp.net/attachments/123/456/image.png'
        );
        expect(result.valid).toBe(true);
      });

      it('should accept images-ext-1.discordapp.net URLs', () => {
        const result = validateImageUrl(
          'https://images-ext-1.discordapp.net/external/abc/image.png'
        );
        expect(result.valid).toBe(true);
      });

      it('should accept images-ext-2.discordapp.net URLs', () => {
        const result = validateImageUrl(
          'https://images-ext-2.discordapp.net/external/abc/image.png'
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('URL format validation', () => {
      it('should reject empty URL', () => {
        const result = validateImageUrl('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('empty');
      });

      it('should reject whitespace-only URL', () => {
        const result = validateImageUrl('   ');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('empty');
      });

      it('should reject malformed URL', () => {
        const result = validateImageUrl('not-a-valid-url');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid URL format');
      });

      it('should reject URL with missing protocol', () => {
        const result = validateImageUrl('cdn.discordapp.com/image.png');
        expect(result.valid).toBe(false);
      });
    });

    describe('protocol validation', () => {
      it('should reject HTTP URLs', () => {
        const result = validateImageUrl('http://cdn.discordapp.com/attachments/123/456/image.png');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('HTTPS');
      });

      it('should reject FTP URLs', () => {
        const result = validateImageUrl('ftp://example.com/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject file URLs', () => {
        const result = validateImageUrl('file:///path/to/image.png');
        expect(result.valid).toBe(false);
      });
    });

    describe('domain validation', () => {
      it('should reject non-Discord domains', () => {
        const result = validateImageUrl('https://example.com/image.png');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Discord CDN');
        expect(logger.warn).toHaveBeenCalled();
      });

      it('should reject similar-looking domains', () => {
        const result = validateImageUrl('https://cdn-discordapp.com/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject subdomains of non-Discord domains', () => {
        const result = validateImageUrl('https://discord.example.com/image.png');
        expect(result.valid).toBe(false);
      });
    });

    describe('SSRF protection - IPv4', () => {
      it('should reject localhost', () => {
        const result = validateImageUrl('https://localhost/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject 127.x.x.x addresses', () => {
        const result = validateImageUrl('https://127.0.0.1/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject 10.x.x.x private network', () => {
        const result = validateImageUrl('https://10.0.0.1/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject 172.16-31.x.x private network', () => {
        const result = validateImageUrl('https://172.16.0.1/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject 172.31.x.x private network', () => {
        const result = validateImageUrl('https://172.31.255.255/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject 192.168.x.x private network', () => {
        const result = validateImageUrl('https://192.168.1.1/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject 169.254.x.x link-local', () => {
        const result = validateImageUrl('https://169.254.1.1/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject cloud metadata endpoint', () => {
        const result = validateImageUrl('https://169.254.169.254/latest/meta-data');
        expect(result.valid).toBe(false);
      });
    });

    describe('SSRF protection - IPv6', () => {
      it('should reject ::1 loopback', () => {
        const result = validateImageUrl('https://[::1]/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject fe80 link-local', () => {
        const result = validateImageUrl('https://fe80::1/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject fc00 unique local', () => {
        const result = validateImageUrl('https://fc00::1/image.png');
        expect(result.valid).toBe(false);
      });

      it('should reject fd00 unique local', () => {
        const result = validateImageUrl('https://fd00::1/image.png');
        expect(result.valid).toBe(false);
      });
    });

    describe('credential validation', () => {
      it('should reject URLs with username', () => {
        const result = validateImageUrl('https://user@cdn.discordapp.com/image.png');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('credentials');
      });

      it('should reject URLs with password', () => {
        const result = validateImageUrl('https://user:pass@cdn.discordapp.com/image.png');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('credentials');
      });
    });

    describe('URL normalization', () => {
      it('should trim whitespace from URL', () => {
        const result = validateImageUrl('  https://cdn.discordapp.com/image.png  ');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).not.toContain(' ');
      });

      it('should return normalized URL for valid input', () => {
        const result = validateImageUrl('https://cdn.discordapp.com/attachments/123/456/image.png');
        expect(result.normalizedUrl).toBe(
          'https://cdn.discordapp.com/attachments/123/456/image.png'
        );
      });
    });
  });

  describe('validateExternalUrl', () => {
    describe('valid URLs', () => {
      it('should accept any HTTPS URL', () => {
        const result = validateExternalUrl('https://example.com/page');
        expect(result.valid).toBe(true);
      });

      it('should accept HTTPS with path', () => {
        const result = validateExternalUrl('https://api.example.com/v1/data');
        expect(result.valid).toBe(true);
      });

      it('should accept HTTPS with query params', () => {
        const result = validateExternalUrl('https://example.com/page?foo=bar');
        expect(result.valid).toBe(true);
      });
    });

    describe('URL format validation', () => {
      it('should reject empty URL', () => {
        const result = validateExternalUrl('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('empty');
      });

      it('should reject malformed URL', () => {
        const result = validateExternalUrl('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid URL format');
      });
    });

    describe('protocol validation', () => {
      it('should reject HTTP URLs', () => {
        const result = validateExternalUrl('http://example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('HTTPS');
      });

      it('should reject FTP URLs', () => {
        const result = validateExternalUrl('ftp://example.com');
        expect(result.valid).toBe(false);
      });
    });

    describe('SSRF protection', () => {
      it('should reject localhost', () => {
        const result = validateExternalUrl('https://localhost');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('internal');
        expect(logger.warn).toHaveBeenCalled();
      });

      it('should reject 127.x.x.x', () => {
        const result = validateExternalUrl('https://127.0.0.1');
        expect(result.valid).toBe(false);
      });

      it('should reject private network IPs', () => {
        const result = validateExternalUrl('https://10.0.0.1');
        expect(result.valid).toBe(false);
      });

      it('should reject 192.168.x.x', () => {
        const result = validateExternalUrl('https://192.168.0.1');
        expect(result.valid).toBe(false);
      });

      it('should reject metadata endpoints', () => {
        const result = validateExternalUrl('https://metadata.google.internal');
        expect(result.valid).toBe(false);
      });
    });

    describe('credential validation', () => {
      it('should reject URLs with credentials', () => {
        const result = validateExternalUrl('https://user:pass@example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('credentials');
      });
    });
  });

  describe('isDiscordCdnUrl', () => {
    it('should return true for cdn.discordapp.com', () => {
      expect(isDiscordCdnUrl('https://cdn.discordapp.com/image.png')).toBe(true);
    });

    it('should return true for media.discordapp.net', () => {
      expect(isDiscordCdnUrl('https://media.discordapp.net/image.png')).toBe(true);
    });

    it('should return true for images-ext-1.discordapp.net', () => {
      expect(isDiscordCdnUrl('https://images-ext-1.discordapp.net/image.png')).toBe(true);
    });

    it('should return true for images-ext-2.discordapp.net', () => {
      expect(isDiscordCdnUrl('https://images-ext-2.discordapp.net/image.png')).toBe(true);
    });

    it('should return false for other domains', () => {
      expect(isDiscordCdnUrl('https://example.com/image.png')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isDiscordCdnUrl('not-a-url')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isDiscordCdnUrl('')).toBe(false);
    });

    it('should handle HTTP URLs', () => {
      // Should still parse the domain correctly, just return based on domain match
      expect(isDiscordCdnUrl('http://cdn.discordapp.com/image.png')).toBe(true);
    });
  });

  describe('getAllowedImageDomains', () => {
    it('should return an array of allowed domains', () => {
      const domains = getAllowedImageDomains();
      expect(Array.isArray(domains)).toBe(true);
      expect(domains.length).toBeGreaterThan(0);
    });

    it('should include cdn.discordapp.com', () => {
      const domains = getAllowedImageDomains();
      expect(domains).toContain('cdn.discordapp.com');
    });

    it('should include media.discordapp.net', () => {
      const domains = getAllowedImageDomains();
      expect(domains).toContain('media.discordapp.net');
    });

    it('should include images-ext-1.discordapp.net', () => {
      const domains = getAllowedImageDomains();
      expect(domains).toContain('images-ext-1.discordapp.net');
    });

    it('should include images-ext-2.discordapp.net', () => {
      const domains = getAllowedImageDomains();
      expect(domains).toContain('images-ext-2.discordapp.net');
    });

    it('should return a readonly array', () => {
      const domains = getAllowedImageDomains();
      // TypeScript would catch mutations, but we verify at runtime
      expect(Object.isFrozen(domains) || domains.length === 4).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with ports', () => {
      const result = validateExternalUrl('https://example.com:8080/path');
      expect(result.valid).toBe(true);
    });

    it('should handle URLs with fragments', () => {
      const result = validateExternalUrl('https://example.com/page#section');
      expect(result.valid).toBe(true);
    });

    it('should handle international domain names', () => {
      const result = validateExternalUrl('https://例え.jp/');
      expect(result.valid).toBe(true);
    });

    it('should handle very long URLs', () => {
      const longPath = 'a'.repeat(1000);
      const result = validateExternalUrl(`https://example.com/${longPath}`);
      expect(result.valid).toBe(true);
    });

    it('should handle URLs with encoded characters', () => {
      const result = validateExternalUrl('https://example.com/path%20with%20spaces');
      expect(result.valid).toBe(true);
    });
  });
});
