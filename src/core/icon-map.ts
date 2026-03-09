/**
 * Icon mapping table.
 * Keys are app bundle identifiers (e.g. "com.tencent.xin").
 * Values are icon URLs (≥64×64).
 * This is the sole source for resolving icon URLs from bundle identifiers.
 */
export const ICON_MAP: Record<string, string> = {
  'org.telegram.messenger':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/Telegram%20Messenger-iOS-512x512.png',
  'com.tencent.mobileqq':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/QQ-iOS-512x512.png',
  'com.taobao.idlefish':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/闲鱼%20-%20神奇的闲鱼！-iOS-512x512.png',
  'com.tencent.mm':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/微信-iOS-512x512.png',
  'com.whatsapp':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/WhatsApp%20Messenger-iOS-512x512.png',
  'com.android.mms':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/信息-iOS-512x512.png',
  'com.android.incallui':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/电话-iOS-512x512.png',
};

/** Look up an icon URL from the map using the given bundle identifier. */
export function lookupIcon(bundleId: string): string | undefined {
  return ICON_MAP[bundleId];
}
