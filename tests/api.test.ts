import { expect, test } from '@rstest/core';
import { GROUP_ICON_MAP } from '../src/core/api';

test('GROUP_ICON_MAP uses app names as keys', () => {
  // Keys should be app names, not package names
  expect(Object.keys(GROUP_ICON_MAP)).toContain('微信');
  expect(Object.keys(GROUP_ICON_MAP)).toContain('闲鱼');
  expect(Object.keys(GROUP_ICON_MAP)).toContain('信息');
  expect(Object.keys(GROUP_ICON_MAP)).toContain('QQ');
  expect(Object.keys(GROUP_ICON_MAP)).toContain('Telegram');
  expect(Object.keys(GROUP_ICON_MAP)).toContain('WhatsApp');
});

test('GROUP_ICON_MAP does not contain package names', () => {
  expect(Object.keys(GROUP_ICON_MAP)).not.toContain('com.tencent.mm');
  expect(Object.keys(GROUP_ICON_MAP)).not.toContain('com.taobao.idlefish');
  expect(Object.keys(GROUP_ICON_MAP)).not.toContain('com.android.mms');
  expect(Object.keys(GROUP_ICON_MAP)).not.toContain('com.tencent.mobileqq');
  expect(Object.keys(GROUP_ICON_MAP)).not.toContain('org.telegram.messenger');
  expect(Object.keys(GROUP_ICON_MAP)).not.toContain('com.whatsapp');
});

test('icon auto-matching resolves app name to preset icon URL', () => {
  expect(GROUP_ICON_MAP['微信']).toBe(
    'https://static-r2.zolmid.com/Static/APP%20LOGO/微信-iOS-512x512.png',
  );
  expect(GROUP_ICON_MAP['QQ']).toBe(
    'https://static-r2.zolmid.com/Static/APP%20LOGO/QQ-iOS-512x512.png',
  );
  expect(GROUP_ICON_MAP['Telegram']).toBe(
    'https://static-r2.zolmid.com/Static/APP%20LOGO/Telegram%20Messenger-iOS-512x512.png',
  );
});
