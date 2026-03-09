import { afterEach, beforeEach, expect, test } from '@rstest/core';
import {
  fetchAppIconFromAppStore,
  ICON_FALLBACK_MAP,
  isUrl,
  lookupIconFromFallbackMap,
} from '../src/core/api';

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
// fetchAppIconFromAppStore – mocked fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

beforeEach(() => {
  // reset to real fetch before each test; individual tests override as needed
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeAppStoreResponse(results: object[]) {
  return Promise.resolve(
    new Response(JSON.stringify({ results }), { status: 200 }),
  );
}

const MOCK_APP = {
  trackId: 123,
  trackName: 'Telegram Messenger',
  artworkUrl512: 'https://example.com/telegram-512.png',
  artworkUrl100: 'https://example.com/telegram-100.png',
};

test('icon URL is identified by isUrl and would be used directly in pushOne', () => {
  // pushOne calls isUrl before fetchAppIconFromAppStore; if isUrl returns true
  // the fetch helper is skipped entirely.
  expect(isUrl('https://example.com/my-icon.png')).toBe(true);
  expect(isUrl('Telegram')).toBe(false); // app name triggers lookup
});

test('fetchAppIconFromAppStore returns artworkUrl512 for exact match', async () => {
  globalThis.fetch = () => makeAppStoreResponse([MOCK_APP]);

  const result = await fetchAppIconFromAppStore('Telegram Messenger');
  expect(result).toBe('https://example.com/telegram-512.png');
});

test('fetchAppIconFromAppStore returns artworkUrl100 when artworkUrl512 absent', async () => {
  const app = { ...MOCK_APP, artworkUrl512: undefined };
  globalThis.fetch = () => makeAppStoreResponse([app]);

  const result = await fetchAppIconFromAppStore('Telegram Messenger');
  expect(result).toBe('https://example.com/telegram-100.png');
});

test('fetchAppIconFromAppStore prefers exact name match over prefix match', async () => {
  const exact = {
    trackId: 1,
    trackName: 'WeChat',
    artworkUrl512: 'https://example.com/wechat-exact.png',
  };
  const prefix = {
    trackId: 2,
    trackName: 'WeChat Mini Programs',
    artworkUrl512: 'https://example.com/wechat-prefix.png',
  };
  // Return prefix match first to test sorting
  globalThis.fetch = () => makeAppStoreResponse([prefix, exact]);

  const result = await fetchAppIconFromAppStore('WeChat');
  expect(result).toBe('https://example.com/wechat-exact.png');
});

test('fetchAppIconFromAppStore deduplicates results across regions', async () => {
  let callCount = 0;
  globalThis.fetch = () => {
    callCount++;
    return makeAppStoreResponse([MOCK_APP]); // same trackId every region
  };

  const result = await fetchAppIconFromAppStore('Telegram Messenger');
  // All 5 regions queried
  expect(callCount).toBe(5);
  // But only one unique candidate (deduped by trackId)
  expect(result).toBe('https://example.com/telegram-512.png');
});

test('fetchAppIconFromAppStore returns undefined when no results match', async () => {
  globalThis.fetch = () =>
    makeAppStoreResponse([
      {
        trackId: 99,
        trackName: 'SomeOtherApp',
        artworkUrl512: 'https://example.com/other.png',
      },
    ]);

  const result = await fetchAppIconFromAppStore('WeChat');
  expect(result).toBeUndefined();
});

test('fetchAppIconFromAppStore returns undefined when all regions fail', async () => {
  globalThis.fetch = () => Promise.reject(new Error('network error'));

  const result = await fetchAppIconFromAppStore('WeChat');
  expect(result).toBeUndefined();
});

test('fetchAppIconFromAppStore returns undefined when API returns non-ok status', async () => {
  globalThis.fetch = () =>
    Promise.resolve(new Response('Server Error', { status: 500 }));

  const result = await fetchAppIconFromAppStore('WeChat');
  expect(result).toBeUndefined();
});

test('fetchAppIconFromAppStore handles mixed region success and failure', async () => {
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    if (calls <= 2) return Promise.reject(new Error('timeout'));
    return makeAppStoreResponse([MOCK_APP]);
  };

  const result = await fetchAppIconFromAppStore('Telegram Messenger');
  expect(result).toBe('https://example.com/telegram-512.png');
});

test('fetchAppIconFromAppStore returns undefined for empty app name', async () => {
  let called = false;
  globalThis.fetch = () => {
    called = true;
    return makeAppStoreResponse([]);
  };
  const result = await fetchAppIconFromAppStore('  ');
  expect(result).toBeUndefined();
  expect(called).toBe(false); // no network call made
});

test('fetchAppIconFromAppStore uses case-insensitive normalized match', async () => {
  const app = {
    trackId: 42,
    trackName: 'telegram messenger',
    artworkUrl512: 'https://example.com/tg.png',
  };
  globalThis.fetch = () => makeAppStoreResponse([app]);

  const result = await fetchAppIconFromAppStore('Telegram Messenger');
  expect(result).toBe('https://example.com/tg.png');
});

// ---------------------------------------------------------------------------
// lookupIconFromFallbackMap
// ---------------------------------------------------------------------------

test('lookupIconFromFallbackMap returns icon URL for a known app name', () => {
  const result = lookupIconFromFallbackMap('Telegram');
  expect(result).toBe(ICON_FALLBACK_MAP['telegram']);
});

test('lookupIconFromFallbackMap is case-insensitive', () => {
  expect(lookupIconFromFallbackMap('TELEGRAM')).toBe(
    ICON_FALLBACK_MAP['telegram'],
  );
  expect(lookupIconFromFallbackMap('WeChat')).toBe(ICON_FALLBACK_MAP['wechat']);
});

test('lookupIconFromFallbackMap returns undefined for unknown app name', () => {
  expect(lookupIconFromFallbackMap('SomeUnknownApp')).toBeUndefined();
});

test('lookupIconFromFallbackMap handles multi-word names with normalization', () => {
  expect(lookupIconFromFallbackMap('Telegram Messenger')).toBe(
    ICON_FALLBACK_MAP['telegram messenger'],
  );
});

// ---------------------------------------------------------------------------
// Fallback map used when App Store API returns no result
// ---------------------------------------------------------------------------

test('fetchAppIconFromAppStore falls back gracefully: caller can use lookupIconFromFallbackMap', async () => {
  // Simulate App Store returning no matching results
  globalThis.fetch = () => makeAppStoreResponse([]);

  const appStoreResult = await fetchAppIconFromAppStore('Telegram');
  expect(appStoreResult).toBeUndefined();

  // Caller should then try the fallback map
  const fallback = lookupIconFromFallbackMap('Telegram');
  expect(fallback).toBe(ICON_FALLBACK_MAP['telegram']);
});

test('ICON_FALLBACK_MAP contains only http/https icon URLs', () => {
  for (const [name, url] of Object.entries(ICON_FALLBACK_MAP)) {
    expect(isUrl(url), `entry "${name}" should have a valid URL`).toBe(true);
  }
});
