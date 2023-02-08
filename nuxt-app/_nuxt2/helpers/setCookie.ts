/**
 * Helper function to set a new browser cookie.
 *
 * @param name The name of the cookie.
 * @param value The value of the cookie.
 * @param days The lifetime of the cookie in days.
 */
export function setCookie(name: string, value: string, days: number) {
  const maxAge = 60 * 60 * 24 * days;
  const domain = window.location.hostname;
  document.cookie = `${name}=${value}; max-age=${maxAge}; domain=${domain}; path=/; samesite=strict; secure`;
}
