import { describe, it, expect } from 'vitest';
import { isCapturableUrl, normalizeUrl, extractDomain, generateTitleFallback } from './url';

describe('isCapturableUrl', () => {
  it('allows http URLs', () => {
    expect(isCapturableUrl('http://example.com')).toBe(true);
  });

  it('allows https URLs', () => {
    expect(isCapturableUrl('https://example.com')).toBe(true);
  });

  it('rejects chrome:// URLs', () => {
    expect(isCapturableUrl('chrome://extensions')).toBe(false);
  });

  it('rejects chrome-extension:// URLs', () => {
    expect(isCapturableUrl('chrome-extension://abc123/page.html')).toBe(false);
  });

  it('rejects file:// URLs', () => {
    expect(isCapturableUrl('file:///home/user/doc.html')).toBe(false);
  });

  it('rejects about: URLs', () => {
    expect(isCapturableUrl('about:blank')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isCapturableUrl('')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isCapturableUrl('not a url')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('lowercases hostname', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/path')).toBe('https://example.com/path');
  });

  it('removes fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('keeps query string', () => {
    expect(normalizeUrl('https://example.com/page?foo=bar')).toBe('https://example.com/page?foo=bar');
  });

  it('removes trailing slash (non-root)', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('keeps trailing slash for root', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('handles complex URLs', () => {
    const url = 'https://WWW.Example.COM/Path/To/Page?query=1#hash';
    expect(normalizeUrl(url)).toBe('https://www.example.com/Path/To/Page?query=1');
  });
});

describe('extractDomain', () => {
  it('extracts domain from URL', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
  });

  it('strips www prefix', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('example.com');
  });

  it('lowercases domain', () => {
    expect(extractDomain('https://EXAMPLE.COM/path')).toBe('example.com');
  });

  it('handles subdomains', () => {
    expect(extractDomain('https://blog.example.com/path')).toBe('blog.example.com');
  });
});

describe('generateTitleFallback', () => {
  it('generates domain + path', () => {
    expect(generateTitleFallback('https://example.com/page')).toBe('example.com/page');
  });

  it('handles root path', () => {
    expect(generateTitleFallback('https://example.com/')).toBe('example.com');
  });

  it('strips www', () => {
    expect(generateTitleFallback('https://www.example.com/page')).toBe('example.com/page');
  });
});
