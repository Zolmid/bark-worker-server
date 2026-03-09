/** Normalize a string for loose comparison (lowercase, collapse whitespace). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_.,!-]+/g, ' ')
    .trim();
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
