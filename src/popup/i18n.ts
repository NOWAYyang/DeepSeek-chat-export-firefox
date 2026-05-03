/**
 * i18n helper — wraps browser.i18n.getMessage for cleaner access in React components.
 */

export function t(key: string, ...subs: string[]): string {
  const msg = browser.i18n.getMessage(key, subs.length > 0 ? subs : undefined);
  return msg || key;
}
