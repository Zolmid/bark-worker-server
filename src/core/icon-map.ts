/**
 * Icon mapping table.
 * Keys are app bundle identifiers (e.g. "com.tencent.xin").
 * Values are icon URLs (≥64×64).
 * This is the sole source for resolving icon URLs from bundle identifiers.
 */
export const ICON_MAP: Record<string, string> = {
  'ph.nicegram.Telegram':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/Telegram%20Messenger-iOS-512x512.png',
  'com.tencent.mqq':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/QQ-iOS-512x512.png',
  'com.taobao.fleamarket':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/闲鱼%20-%20神奇的闲鱼！-iOS-512x512.png',
  'com.tencent.xin':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/微信-iOS-512x512.png',
  'net.whatsapp.WhatsApp':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/WhatsApp%20Messenger-iOS-512x512.png',
  'com.apple.MobileSMS':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/信息-iOS-512x512.png',
  'com.apple.mobilephone':
    'https://static-r2.zolmid.com/Static/APP%20LOGO/电话-iOS-512x512.png',
};

/** Look up an icon URL from the map using the given bundle identifier. */
export function lookupIcon(bundleId: string): string | undefined {
  return ICON_MAP[bundleId];
}
