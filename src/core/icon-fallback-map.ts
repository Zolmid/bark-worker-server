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
  Telegram:
    'https://static-r2.zolmid.com/Static/APP%20LOGO/Telegram%20Messenger-iOS-512x512.png',
  QQ:
    'https://static-r2.zolmid.com/Static/APP%20LOGO/QQ-iOS-512x512.png',
  闲鱼:
    'https://static-r2.zolmid.com/Static/APP%20LOGO/闲鱼%20-%20神奇的闲鱼！-iOS-512x512.png',
  微信: 
    'https://static-r2.zolmid.com/Static/APP%20LOGO/微信-iOS-512x512.png',
  WhatsApp:
    'https://static-r2.zolmid.com/Static/APP%20LOGO/WhatsApp%20Messenger-iOS-512x512.png',
  信息:
    'https://static-r2.zolmid.com/Static/APP%20LOGO/信息-iOS-512x512.png',
  电话:
    'https://static-r2.zolmid.com/Static/APP%20LOGO/电话-iOS-512x512.png',
};

/** Look up an icon URL from the fallback map using the given app name. */
export function lookupIconFromFallbackMap(appName: string): string | undefined {
  const key = normalizeName(appName);
  return ICON_FALLBACK_MAP[key];
}
