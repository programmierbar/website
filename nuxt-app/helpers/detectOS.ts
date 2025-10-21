export type OS =
  | 'iOS' | 'Android' | 'macOS' | 'Windows' | 'Linux' | 'ChromeOS' | 'Unknown';

export function detectOSFromUA(ua: string): OS {
  const s = ua.toLowerCase();
  if (/android/.test(s)) return 'Android';
  // iPadOS 13+ reports as Mac with touch; catch iPhone/iPad/iPod too
  if (/(iphone|ipad|ipod)/.test(s) || (/mac os x/.test(s) && 'ontouchstart' in globalThis)) return 'iOS';
  if (/windows nt/.test(s)) return 'Windows';
  if (/mac os x/.test(s)) return 'macOS';
  if (/cros/.test(s)) return 'ChromeOS';
  if (/linux/.test(s)) return 'Linux';
  return 'Unknown';
}

export function preferClientHints(
  headers: Record<string, string | string[] | undefined>
): OS | null {
  const raw = (headers['sec-ch-ua-platform'] ??
    headers['Sec-CH-UA-Platform']) as string | undefined;
  if (!raw) return null;
  // CH values are quoted, e.g. `"Windows"`, `"macOS"`, `"Android"`, `"iOS"`
  const platform = raw.replaceAll('"', '');
  switch (platform) {
    case 'Android': return 'Android';
    case 'iOS': return 'iOS';
    case 'macOS': return 'macOS';
    case 'Windows': return 'Windows';
    case 'Linux': return 'Linux';
    case 'Chrome OS': return 'ChromeOS';
    default: return 'Unknown';
  }
}

export function getOS() {
  const os = useState<OS>('os', () => 'Unknown');
  if (import.meta.server) {
    const headers = useRequestHeaders([
      'sec-ch-ua-platform', 'Sec-CH-UA-Platform', 'user-agent'
    ]);
    os.value = preferClientHints(headers)
      ?? detectOSFromUA(headers['user-agent'] || '');
  } else if (import.meta.client) {
    // Hydration fallback (in case CH were missing on first SSR)
    if (os.value === 'Unknown') {
      os.value = detectOSFromUA(navigator.userAgent);
    }

    return os.value;
  }
}
