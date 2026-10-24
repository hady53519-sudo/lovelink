import { describe, expect, it } from 'vitest';
import { parseSongUrl, parseVideoUrl } from '../media';
import { daysSince, isValidDate, validatePassword, validateStep } from '../validation';
import { sniffImageType } from '../files';
import { emptyContent } from '../../types';

describe('media parsing', () => {
  it('accepts YouTube and Spotify songs', () => {
    expect(parseSongUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.provider).toBe('youtube');
    expect(parseSongUrl('https://youtu.be/dQw4w9WgXcQ')?.embedUrl).toContain('/embed/dQw4w9WgXcQ');
    expect(parseSongUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')?.provider).toBe('spotify');
    expect(parseSongUrl('https://open.spotify.com/intl-ar/track/4uLU6hMCjMI75M1A2tKUQC')?.embedUrl).toBe(
      'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
    );
  });
  it('rejects unsupported or unsafe URLs', () => {
    expect(parseSongUrl('http://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(parseSongUrl('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseSongUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseSongUrl('javascript:alert(1)')).toBeNull();
    expect(parseSongUrl('https://user:pw@youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
  it('accepts Vimeo for videos but not for songs', () => {
    expect(parseVideoUrl('https://vimeo.com/123456789')?.provider).toBe('vimeo');
    expect(parseSongUrl('https://vimeo.com/123456789')).toBeNull();
  });
});

describe('validation', () => {
  it('requires names, title and message', () => {
    const c = emptyContent();
    expect(Object.keys(validateStep(c, 0)).sort()).toEqual(['nameA', 'nameB', 'title']);
    expect(validateStep(c, 1).message).toBe('err.required');
  });
  it('validates dates and passwords', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(validatePassword('abc')).toBe('err.passwordShort');
    expect(validatePassword('abcd')).toBeNull();
  });
  it('counts days', () => {
    expect(daysSince('2024-01-01', new Date(2024, 0, 11))).toBe(10);
    expect(daysSince('2024-01-11', new Date(2024, 0, 1))).toBe(-10);
  });
});

describe('file sniffing', () => {
  it('detects real image signatures', async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])]);
    const fake = new Blob(['<svg onload=alert(1)>']);
    expect(await sniffImageType(png)).toBe('image/png');
    expect(await sniffImageType(fake)).toBeNull();
  });
});
