import { createHash } from 'node:crypto'
import { isIPv4, isIPv6 } from 'node:net'
import { getHeader } from 'h3'
import { useDirectus } from '~/composables/useDirectus'

/**
 * Expand a compressed IPv6 address to its full 8-group form.
 * Handles ::1, ::ffff:x.x.x.x, and other compressed forms.
 */
function expandIPv6(ip: string): string {
  // Handle IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1)
  const v4Mapped = ip.match(/^(.*)::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)
  if (v4Mapped) {
    // Convert the IPv4 part to two IPv6 groups
    const v4Parts = v4Mapped[2].split('.').map(Number)
    const group7 = ((v4Parts[0] << 8) | v4Parts[1]).toString(16)
    const group8 = ((v4Parts[2] << 8) | v4Parts[3]).toString(16)
    ip = `${v4Mapped[1] || '0:0:0:0:0'}:ffff:${group7}:${group8}`
  }

  // Expand :: into the correct number of zero groups
  if (ip.includes('::')) {
    const [left, right] = ip.split('::')
    const leftGroups = left ? left.split(':') : []
    const rightGroups = right ? right.split(':') : []
    const missing = 8 - leftGroups.length - rightGroups.length
    const zeroGroups = Array(missing).fill('0000')
    const allGroups = [...leftGroups, ...zeroGroups, ...rightGroups]
    return allGroups.map(g => g.padStart(4, '0')).join(':')
  }

  return ip.split(':').map(g => g.padStart(4, '0')).join(':')
}

/**
 * Validate, anonymize, and SHA-256 hash an IP address.
 * Returns hex string or undefined if the IP is invalid.
 */
function anonymizeAndHashIP(rawIP: string): string | undefined {
  const trimmed = rawIP.trim()

  if (isIPv4(trimmed)) {
    // Anonymize IPv4: zero last 2 octets
    const parts = trimmed.split('.')
    parts[2] = '0'
    parts[3] = '0'
    const anonymized = parts.join('.')
    return createHash('sha256').update(anonymized).digest('hex')
  }

  if (isIPv6(trimmed)) {
    // Expand to full form, then zero last 4 groups
    const expanded = expandIPv6(trimmed)
    const groups = expanded.split(':')
    for (let i = 4; i < 8; i++) {
      groups[i] = '0000'
    }
    const anonymized = groups.join(':')
    return createHash('sha256').update(anonymized).digest('hex')
  }

  return undefined
}

export default eventHandler(async function(event) {
  const requestPath = event.path;
  if (!requestPath.startsWith('/podcast/')) {
    return;
  }

  // Path pattern "/podcast/[slug]/[up|down]"
  const regex = /^\/podcast\/([^/]+)\/(up|down)$/;
  const match = requestPath.match(regex);
  if (!match) {
    return;
  }

  const slug = match[1];
  const voteString = match[2];

  // Type narrowing: the regex already validated this is "up" or "down"
  // We use a type guard to make TypeScript aware of this
  if (voteString !== 'up' && voteString !== 'down') {
    // This should never happen due to regex validation, but satisfies TypeScript
    throw createError({ statusCode: 400, message: 'Invalid vote value' });
  }
  const vote = voteString;

  const directus = useDirectus();

  const podcast = await directus.getPodcastBySlug(slug);

  if (!podcast) {
    throw createError({ statusCode: 404, message: 'Podcast not found' });
  }

  // Content negotiation: detect if the client wants JSON
  const accept = (getHeader(event, 'accept') || '').toLowerCase()
  const wantsJson = accept.includes('application/json') && !accept.includes('text/html')

  let success = false;
  let message = '';

  try {
    const metadata: Record<string, string> = {};

    // Fix: split x-forwarded-for on comma and take first entry
    const xForwardedFor = event.node.req.headers['x-forwarded-for'] as string | undefined;
    const rawIP = xForwardedFor
      ? xForwardedFor.split(',')[0].trim()
      : event.node.req.socket.remoteAddress;

    const userAgent = event.node.req.headers['user-agent'];
    const referrer = event.node.req.headers['referer'];

    // Process IP server-side: validate, anonymize, and hash
    if (rawIP) {
      const hashedIP = anonymizeAndHashIP(rawIP);
      if (hashedIP) {
        metadata['ip'] = hashedIP;
      }
    }
    if (userAgent) {
      metadata['user_agent'] = userAgent;
    }
    if (referrer) {
      metadata['referer_url'] = referrer;
    }

    await directus.createRating(vote, podcast, metadata);
    success = true;
    message = 'Vielen Dank für dein Feedback!';
  } catch (error) {
    // Log the error and set an error flash message
    console.error('Failed to create rating for podcast', podcast.slug, error);
    success = false;
    message = 'Dein Feedback konnte leider nicht gespeichert werden. Bitte versuche es später erneut.';
  }

  // Content negotiation: JSON response for fetch() calls
  if (wantsJson) {
    event.node.res.setHeader('Vary', 'Accept')
    return { success, message };
  }

  // Redirect response for direct browser navigation
  setCookie(event, 'flash-message', JSON.stringify({
    text: message,
    type: 'rating',
    payload: {}
  }), {
    maxAge: 60, // 60 seconds
    path: '/'
  });

  event.node.res.writeHead(302, {
    Location: '/podcast/' + podcast.slug,
  });

  event.node.res.end();
});
