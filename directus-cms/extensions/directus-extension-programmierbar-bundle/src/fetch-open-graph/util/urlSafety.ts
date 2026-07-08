import { lookup } from 'node:dns/promises'

/**
 * A DNS resolver returning every address a hostname resolves to. Matches the
 * shape of `dns/promises.lookup(host, { all: true })`; injectable for testing.
 */
export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>

const defaultResolver: Resolver = (hostname) => lookup(hostname, { all: true })

/**
 * Whether an IP address belongs to a loopback, private, link-local or otherwise
 * non-public range that a server-side fetch must never reach (SSRF protection).
 *
 * Covers the ranges that matter in practice, including the cloud metadata
 * endpoint (169.254.169.254, inside link-local) and IPv6 loopback / unique-local
 * / link-local / IPv4-mapped addresses.
 *
 * @param ip A textual IPv4 or IPv6 address.
 */
export function isDisallowedIp(ip: string): boolean {
    const address = ip.toLowerCase().trim()

    // IPv6
    if (address.includes(':')) {
        if (address === '::1' || address === '::') {
            return true
        }
        // Unique-local (fc00::/7) and link-local (fe80::/10).
        if (/^f[cd][0-9a-f]{2}:/.test(address) || /^fe[89ab][0-9a-f]:/.test(address)) {
            return true
        }
        // IPv4-mapped IPv6 (::ffff:a.b.c.d) — validate the embedded IPv4.
        const mapped = address.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
        if (mapped) {
            return isDisallowedIp(mapped[1]!)
        }
        return false
    }

    // IPv4
    const octets = address.split('.').map((part) => Number(part))
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        // Not a parseable IPv4 literal — treat as unsafe rather than guess.
        return true
    }
    const [a, b] = octets as [number, number, number, number]

    return (
        a === 0 || // "this" network / unspecified
        a === 10 || // 10.0.0.0/8 private
        a === 127 || // loopback
        (a === 169 && b === 254) || // link-local, incl. cloud metadata 169.254.169.254
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
        (a === 192 && b === 168) || // 192.168.0.0/16 private
        (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 carrier-grade NAT
        a >= 224 // multicast (224/4) and reserved (240/4)
    )
}

/**
 * Validate that a URL is safe for the server to fetch: it must use http(s) and
 * must not resolve to any loopback/private/link-local/reserved address. Throws
 * with a descriptive message otherwise. Guards against SSRF where an
 * editor-supplied link points (directly or via DNS) at internal infrastructure.
 *
 * Note: there is a residual DNS-rebinding TOCTOU window between this lookup and
 * the actual fetch; fully closing it would require pinning the connection to the
 * validated IP, which is out of scope for this internal CMS.
 *
 * @param rawUrl The URL to validate.
 * @param resolver DNS resolver (injectable for tests).
 */
export async function assertPublicUrl(rawUrl: string, resolver: Resolver = defaultResolver): Promise<void> {
    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        throw new Error(`Invalid URL: ${rawUrl}`)
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`Refusing to fetch non-http(s) URL: ${rawUrl}`)
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, '') // strip IPv6 brackets

    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error(`Refusing to fetch internal host: ${hostname}`)
    }

    const addresses = await resolver(hostname)
    if (addresses.length === 0) {
        throw new Error(`Could not resolve host: ${hostname}`)
    }

    for (const { address } of addresses) {
        if (isDisallowedIp(address)) {
            throw new Error(`Refusing to fetch URL resolving to non-public address ${address}: ${rawUrl}`)
        }
    }
}
