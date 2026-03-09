import { expect, test } from '@rstest/core';
import { isUrl } from '../src/core/api';
import { ICON_MAP, lookupIcon } from '../src/core/icon-map';

// ---------------------------------------------------------------------------
// isUrl
// ---------------------------------------------------------------------------

test('isUrl returns true for http/https URLs', () => {
  expect(isUrl('https://example.com/icon.png')).toBe(true);
  expect(isUrl('http://example.com/icon.png')).toBe(true);
  expect(isUrl('https://is2.mzstatic.com/image/thumb/foo/512x512.png')).toBe(
    true,
  );
});

test('isUrl returns false for plain app names and non-URL strings', () => {
  expect(isUrl('微信')).toBe(false);
  expect(isUrl('Telegram')).toBe(false);
  expect(isUrl('WeChat')).toBe(false);
  expect(isUrl('com.tencent.mm')).toBe(false);
  expect(isUrl('')).toBe(false);
  expect(isUrl('ftp://example.com')).toBe(false); // non http/https
});

// ---------------------------------------------------------------------------
// lookupIcon
// ---------------------------------------------------------------------------

test('lookupIcon returns icon URL for a known bundle identifier', () => {
  const result = lookupIcon('ph.nicegram.Telegram');
  expect(result).toBe(ICON_MAP['ph.nicegram.Telegram']);
});

test('lookupIcon returns icon URL for WeChat bundle identifier', () => {
  const result = lookupIcon('com.tencent.xin');
  expect(result).toBe(ICON_MAP['com.tencent.xin']);
});

test('lookupIcon returns undefined for unknown bundle identifier', () => {
  expect(lookupIcon('com.unknown.app')).toBeUndefined();
});

test('lookupIcon uses exact match (case-sensitive)', () => {
  // Bundle identifiers are case-sensitive; wrong case should return undefined
  expect(lookupIcon('PH.NICEGRAM.TELEGRAM')).toBeUndefined();
  expect(lookupIcon('com.tencent.XIN')).toBeUndefined();
});

// ---------------------------------------------------------------------------
// ICON_MAP URL validity
// ---------------------------------------------------------------------------

test('ICON_MAP contains only http/https icon URLs', () => {
  for (const [bundleId, url] of Object.entries(ICON_MAP)) {
    expect(isUrl(url), `entry "${bundleId}" should have a valid URL`).toBe(
      true,
    );
  }
});

// ---------------------------------------------------------------------------
// icon URL direct pass-through (isUrl check used in pushOne)
// ---------------------------------------------------------------------------

test('icon URL is identified by isUrl and would be used directly in pushOne', () => {
  // pushOne calls isUrl; if it returns true the map lookup is skipped entirely.
  expect(isUrl('https://example.com/my-icon.png')).toBe(true);
  expect(isUrl('com.tencent.xin')).toBe(false); // bundle id triggers map lookup
});
