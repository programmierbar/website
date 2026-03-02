import { directus } from '~/services';
import { readSingleton } from '@directus/sdk';

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
 * Uses dynamic imports for node:crypto and node:net to avoid client bundle errors.
 */
async function anonymizeAndHashIP(rawIP: string): Promise<string | undefined> {
  const { createHash } = await import('node:crypto')
  const { isIPv4, isIPv6 } = await import('node:net')

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

export { anonymizeAndHashIP };
