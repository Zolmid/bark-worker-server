import type { Context } from 'hono';
import { push, regenerateAuthToken } from './apns';
import type { DBAdapter, Options } from './type';
import { getTimestamp, newShortUUID } from './utils';

/** Regions to query when searching the App Store. */
const APPSTORE_REGIONS = ['us', 'cn', 'gb', 'jp', 'kr'];

/** Debug logger for the icon resolution flow. */
function logDebug(message: string): void {
  console.debug(`[icon] ${message}`);
}

/** Error logger for the icon resolution flow. */
function logError(message: string, err?: unknown): void {
  const detail = err instanceof Error ? `: ${err.message}` : '';
  console.error(`[icon] ${message}${detail}`);
}

/**
 * Fallback icon mapping table.
 * Keys are normalized app names (lowercase, whitespace-collapsed via normalizeName).
 * Values are icon URLs (≥64×64).
 * Used when the App Store API is unavailable or returns no confident match.
 * Note: artwork URLs from Apple's CDN may become stale (return 404 or wrong icon)
 * when developers update their app icons. Verify and update these entries periodically.
 */
export const ICON_FALLBACK_MAP: Record<string, string> = {
  telegram:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/47/f5/59/47f55928-a47d-f91a-df2f-03fc4b2994a7/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg',
  'telegram messenger':
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/47/f5/59/47f55928-a47d-f91a-df2f-03fc4b2994a7/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg',
  wechat:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/32/87/01/3287015c-0af4-a2fa-bac6-63b8cef70e8f/AppIcon-0-0-1x_U007epad-0-1-0-0-85-220.png/512x512bb.jpg',
  微信: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/32/87/01/3287015c-0af4-a2fa-bac6-63b8cef70e8f/AppIcon-0-0-1x_U007epad-0-1-0-0-85-220.png/512x512bb.jpg',
  whatsapp:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/15/5e/da/155eda69-1c32-eb14-e7c5-a6e6efab9b65/AppIcon-0-0-1x_U007emarketing-0-0-0-10-0-0-85-220.png/512x512bb.jpg',
  gmail:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/c3/e5/86/c3e58621-43e9-e7fb-5c6b-6c05e9a1ea6e/AppIcon-0-0-1x_U007emarketing-0-0-0-10-0-0-85-220.png/512x512bb.jpg',
  youtube:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/6e/e3/15/6ee315ba-d55e-9040-9827-1e5a60a1b025/YouTubeAppIcon-0-0-1x_U007emarketing-0-10-0-85-220.png/512x512bb.jpg',
};

/** Look up an icon URL from the fallback map using the given app name. */
export function lookupIconFromFallbackMap(appName: string): string | undefined {
  const key = normalizeName(appName);
  return ICON_FALLBACK_MAP[key];
}

interface AppStoreResult {
  trackId: number;
  trackName: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
}

/** Returns true if the string is an HTTP/HTTPS URL. */
export function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Normalize a string for loose comparison (lowercase, collapse whitespace). */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_.,!-]+/g, ' ')
    .trim();
}

/** Score how well a result's trackName matches the queried app name (higher = better). */
function scoreMatch(query: string, trackName: string): number {
  if (trackName === query) return 10;
  const nq = normalizeName(query);
  const nt = normalizeName(trackName);
  if (nt === nq) return 8;
  if (nt.startsWith(nq) || nq.startsWith(nt)) return 5;
  return 0;
}

/** Return the best icon URL (≥64×64) from an App Store result. */
function getBestIconUrl(result: AppStoreResult): string | undefined {
  // artworkUrl512 (512×512) > artworkUrl100 (100×100); both satisfy ≥64×64.
  return result.artworkUrl512 || result.artworkUrl100;
}

/**
 * Query the iTunes Search API across multiple regions, score results by name
 * similarity, and return the icon URL (≥64×64) of the best match.
 * Returns undefined if no confident match is found or all requests fail.
 */
export async function fetchAppIconFromAppStore(
  appName: string,
): Promise<string | undefined> {
  if (!appName.trim()) {
    logDebug('skipping App Store lookup: empty app name');
    return undefined;
  }

  logDebug(
    `querying App Store for "${appName}" across regions: ${APPSTORE_REGIONS.join(', ')}`,
  );

  const regionResults = await Promise.allSettled(
    APPSTORE_REGIONS.map(async (country) => {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(appName)}&entity=software&country=${country}&limit=5`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
          logDebug(
            `App Store region "${country}": non-OK status ${res.status}`,
          );
          return [] as AppStoreResult[];
        }
        const data = (await res.json()) as { results: AppStoreResult[] };
        const results = data.results || ([] as AppStoreResult[]);
        logDebug(`App Store region "${country}": ${results.length} result(s)`);
        return results;
      } catch (err) {
        logError(`App Store region "${country}" query failed`, err);
        return [] as AppStoreResult[];
      }
    }),
  );

  const seen = new Set<number>();
  const candidates: { score: number; result: AppStoreResult }[] = [];

  for (const r of regionResults) {
    if (r.status !== 'fulfilled') continue;
    for (const result of r.value) {
      if (seen.has(result.trackId)) continue;
      seen.add(result.trackId);
      const score = scoreMatch(appName, result.trackName);
      if (score > 0 && getBestIconUrl(result)) {
        logDebug(
          `App Store candidate "${result.trackName}" (id: ${result.trackId}) score: ${score}`,
        );
        candidates.push({ score, result });
      }
    }
  }

  if (candidates.length === 0) {
    logDebug(`App Store: no confident match found for "${appName}"`);
    return undefined;
  }

  // Sort by score descending; stable because sort order is deterministic.
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const iconUrl = getBestIconUrl(best.result);
  if (!iconUrl) return undefined;
  logDebug(
    `App Store: selected "${best.result.trackName}" (score: ${best.score}) icon URL: ${iconUrl}`,
  );
  return iconUrl;
}

export class APIError extends Error {
  code: number;
  message: string;
  timestamp: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.message = message;
    this.timestamp = getTimestamp();
  }
}

const buildSuccess = (data?: any, message = 'success') => ({
  code: 200,
  message,
  timestamp: getTimestamp(),
  data,
});

export type PushParameters = Partial<{
  device_key: string;
  device_keys: string[];

  title: string;
  subtitle: string;
  body: string;
  sound: string;
  group: string;
  call: boolean;
  isArchive: boolean;
  icon: string;
  ciphertext: string;
  level: string;
  volume: number;
  url: string;
  image: string;
  copy: boolean;
  badge: number;
  autoCopy: boolean;
  action: string;
  iv: string;
  id: string;
  delete: boolean;
  markdown: string;
}>;

export class API {
  db: DBAdapter;
  options: Options;

  constructor(options: Options) {
    this.db = options.db;
    this.options = options;
  }

  async register(deviceToken?: string, key?: string) {
    if (!deviceToken) {
      throw new APIError(400, 'device token is empty');
    }

    if (deviceToken.length > 128) {
      throw new APIError(400, 'device token is invalid');
    }

    if (!(key && (await this.db.deviceTokenByKey(key)))) {
      if (this.options.allowNewDevice) {
        key = await newShortUUID();
      } else {
        throw new APIError(
          500,
          'device registration failed: register disabled',
        );
      }
    }

    if (deviceToken === 'deleted') {
      await this.db.deleteDeviceByKey(key);
      return buildSuccess({
        key: key,
        device_key: key,
        device_token: 'deleted',
      });
    }

    await this.db.saveDeviceTokenByKey(key, deviceToken);
    return buildSuccess({
      key: key,
      device_key: key,
      device_token: deviceToken,
    });
  }

  ping() {
    return buildSuccess(undefined, 'pong');
  }

  async info() {
    let devices: number | undefined;
    if (this.options.allowQueryNums) {
      devices = await this.db.countAll();
    }

    return {
      version: 'v2.2.6',
      build: '2025-12-03 10:51:22',
      arch: `js/${process.env.ENTRY}`,
      commit: '18d1037eab7a2310f595cfd31ea49b444f6133f2',
      time: Date.now(),
      devices: devices,
    };
  }

  async push(parameters: PushParameters, ctx?: Context) {
    // batch
    if (
      Array.isArray(parameters.device_keys) &&
      parameters.device_keys.length > 0
    ) {
      if (
        !Number.isNaN(this.options.maxBatchPushCount) &&
        this.options.maxBatchPushCount > 0
      ) {
        if (parameters.device_keys.length > this.options.maxBatchPushCount) {
          throw new APIError(
            400,
            `batch push count exceeds the maximum limit: ${this.options.maxBatchPushCount}`,
          );
        }
      }

      return buildSuccess({
        data: await Promise.all(
          parameters.device_keys.map(async (deviceKey) => {
            try {
              const res = await this.pushOne(deviceKey, parameters, ctx);
              return {
                code: res.code,
                device_key: deviceKey,
              };
            } catch (e) {
              if (e instanceof Error) {
                return {
                  code: e instanceof APIError ? e.code : 500,
                  device_key: deviceKey,
                  message: e.message,
                };
              }
            }
          }),
        ),
      });
    }

    const deviceKey = parameters.device_key;
    if (!deviceKey) {
      throw new APIError(400, 'device key is empty');
    }
    return this.pushOne(deviceKey, parameters, ctx);
  }

  private async pushOne(
    deviceKey: string,
    parameters: PushParameters,
    ctx?: Context,
  ) {
    const deviceToken = await this.db.deviceTokenByKey(deviceKey);
    if (deviceToken === undefined) {
      throw new APIError(
        400,
        `failed to get device token: failed to get [${deviceKey}] device token from database`,
      );
    }

    if (!deviceToken) {
      throw new APIError(400, 'device token invalid');
    }
    if (deviceToken.length > 128) {
      await this.db.deleteDeviceByKey(deviceKey);
      throw new APIError(400, 'invalid device token, has been removed');
    }

    const title = parameters.title || undefined;
    const subtitle = parameters.subtitle || undefined;
    const body = parameters.body || undefined;

    // Resolve icon:
    //   1. URL  → use directly.
    //   2. App name → query App Store API.
    //   3. App Store returns nothing → fall back to static mapping table.
    if (parameters.icon) {
      logDebug(`received icon value: "${parameters.icon}"`);
      if (isUrl(parameters.icon)) {
        logDebug('icon is a URL, using directly');
      } else {
        logDebug(`icon is not a URL, treating as app name`);
        let resolved: string | undefined;
        try {
          resolved = await fetchAppIconFromAppStore(parameters.icon);
        } catch (err) {
          logError(`App Store API query failed for "${parameters.icon}"`, err);
        }
        if (resolved) {
          logDebug(`icon resolved via App Store API: ${resolved}`);
          parameters.icon = resolved;
        } else {
          logDebug(
            `App Store API returned no result for "${parameters.icon}", trying fallback map`,
          );
          const fallback = lookupIconFromFallbackMap(parameters.icon);
          if (fallback) {
            logDebug(`icon resolved via fallback map: ${fallback}`);
            parameters.icon = fallback;
          } else {
            logDebug(
              `fallback map: no entry for "${parameters.icon}"; icon field kept as-is`,
            );
          }
        }
      }
    }

    let sound = parameters.sound || undefined;
    if (sound) {
      if (!sound.endsWith('.caf')) {
        sound += '.caf';
      }
    } else {
      sound = '1107';
    }

    // https://developer.apple.com/documentation/usernotifications/generating-a-remote-notification
    const aps = {
      aps: parameters.delete
        ? {
            'content-available': 1,
            'mutable-content': 1,
          }
        : {
            alert: {
              title: title,
              subtitle: subtitle,
              body: !title && !subtitle && !body ? 'Empty Message' : body,
              'launch-image': undefined,
              'title-loc-key': undefined,
              'title-loc-args': undefined,
              'subtitle-loc-key': undefined,
              'subtitle-loc-args': undefined,
              'loc-key': undefined,
              'loc-args': undefined,
            },
            badge: undefined,
            sound: sound,
            'thread-id': parameters.group,
            category: 'myNotificationCategory',
            'content-available': undefined,
            'mutable-content': 1,
            'target-content-id': undefined,
            'interruption-level': undefined,
            'relevance-score': undefined,
            'filter-criteria': undefined,
            'stale-date': undefined,
            'content-state': undefined,
            timestamp: undefined,
            event: undefined,
            'dimissal-date': undefined,
            'attributes-type': undefined,
            attributes: undefined,
          },
      // ExtParams
      group: parameters.group,
      call: parameters.call,
      isarchive: parameters.isArchive,
      icon: parameters.icon,
      ciphertext: parameters.ciphertext,
      level: parameters.level,
      volume: parameters.volume,
      url: parameters.url,
      copy: parameters.copy,
      badge: parameters.badge,
      autocopy: parameters.autoCopy,
      action: parameters.action,
      iv: parameters.iv,
      image: parameters.image,
      id: parameters.id,
      delete: parameters.delete,
      markdown: parameters.markdown,
    };

    const headers: Record<string, string> = {
      'apns-push-type': parameters.delete ? 'background' : 'alert',
    };
    if (parameters.id) {
      headers['apns-collapse-id'] = parameters.id;
    }

    const handleResponse = async (
      resp: Awaited<ReturnType<typeof push>>,
      retryCount = 0,
    ) => {
      if (resp.status === 200) {
        return buildSuccess(undefined);
      }
      if (
        response.status === 410 ||
        (response.status === 400 && response.message.includes('BadDeviceToken'))
      ) {
        await this.db.deleteDeviceByKey(deviceKey);
      }

      if (
        retryCount === 0 &&
        response.status === 403 &&
        response.message.includes('ExpiredProviderToken')
      ) {
        // Token expired, try again
        await regenerateAuthToken(this.db);
        return handleResponse(
          await push(this.options, deviceToken, headers, aps, ctx),
          retryCount + 1,
        );
      }

      throw new APIError(response.status, `push failed: ${response.message}`);
    };

    const response = await push(this.options, deviceToken, headers, aps, ctx);

    return await handleResponse(response);
  }
}
