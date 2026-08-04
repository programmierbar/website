/**
 * The kind of link a CMS field is meant to hold.
 *
 * Anything other than `web` can also accept a bare handle, because that is what editors tend to type
 * into a social field. Knowing the platform is what makes a handle resolvable: `t.muelleer` is a
 * perfectly good Instagram username but reads like a hostname, and only the field it came from can
 * settle which was meant.
 */
export type ExternalUrlKind =
    'web' | 'twitter' | 'instagram' | 'linkedin' | 'github' | 'youtube' | 'bluesky' | 'mastodon'

interface PlatformRules {
    /** Hosts that mean "this is already a URL, just missing its scheme". */
    hosts: string[]
    /** Builds a profile URL from a bare handle, or returns undefined if it cannot. */
    profileUrl: ((handle: string) => string | undefined) | null
}

const PLATFORMS: Record<ExternalUrlKind, PlatformRules> = {
    // A website field has no handle form — a value with no host is simply unusable.
    web: { hosts: [], profileUrl: null },
    twitter: {
        hosts: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
        profileUrl: (handle) => `https://twitter.com/${handle}`,
    },
    instagram: {
        hosts: ['instagram.com', 'www.instagram.com'],
        profileUrl: (handle) => `https://www.instagram.com/${handle}`,
    },
    linkedin: {
        // Personal profiles live under /in/. Company pages use /company/ and are always pasted as a
        // full URL, so they take the absolute path through this function.
        hosts: ['linkedin.com', 'www.linkedin.com'],
        profileUrl: (handle) => `https://www.linkedin.com/in/${handle}`,
    },
    github: {
        hosts: ['github.com', 'www.github.com'],
        profileUrl: (handle) => `https://github.com/${handle}`,
    },
    youtube: {
        // YouTube handles are @-prefixed in URLs, unlike the others.
        hosts: ['youtube.com', 'www.youtube.com', 'youtu.be'],
        profileUrl: (handle) => `https://www.youtube.com/@${handle}`,
    },
    bluesky: {
        // Bluesky handles are themselves domains (`someone.bsky.social`), so a dot means nothing here.
        hosts: ['bsky.app', 'www.bsky.app'],
        profileUrl: (handle) => `https://bsky.app/profile/${handle}`,
    },
    mastodon: {
        // Federated, so the instance is part of the handle: `@user@instance.social`.
        hosts: [],
        profileUrl: (handle) => {
            const [user, instance] = handle.split('@')
            return user && instance ? `https://${instance}/@${user}` : undefined
        },
    },
}

/**
 * Makes a CMS-entered link safe to put in an `href`, or returns `undefined` if it cannot be.
 *
 * Editors leave the scheme off — `www.linkedin.com/in/someone` rather than
 * `https://www.linkedin.com/in/someone`. A browser resolves that against the current page, so the link
 * lands on `/hall-of-fame/www.linkedin.com/in/someone` and shows the visitor a 404 on our own domain
 * instead of taking them to the profile.
 *
 * They also paste bare handles into social fields. With `kind` set, those become real profile URLs;
 * with `kind` left at `web`, a value that cannot be a host is dropped rather than guessed at.
 *
 * Whatever comes back is absolute, root-relative, or `undefined` — never something a browser would
 * resolve against the current page. Callers should omit the link entirely for `undefined`.
 *
 * @param url The raw value from the CMS.
 * @param kind Which field it came from. Defaults to `web`.
 *
 * @returns A URL safe to use as an `href`, or `undefined`.
 */
export function normalizeExternalUrl(
    url: string | null | undefined,
    kind: ExternalUrlKind = 'web'
): string | undefined {
    const trimmed = url?.trim()

    if (!trimmed) {
        return undefined
    }

    // Already absolute (http(s):, mailto:, tel:), protocol-relative, or deliberately site-internal.
    const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)
    if (schemeMatch) {
        const scheme = schemeMatch[1].toLowerCase()
        if (scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel') {
            return trimmed
        }

        return undefined
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('/')) {
        return trimmed
    }

    const rules = PLATFORMS[kind]
    const host = (trimmed.split(/[/?#]/)[0] ?? '').toLowerCase()

    // A URL missing only its scheme: either it names one of the platform's own hosts, or it has a path
    // after something host-shaped, which a handle never does.
    if (rules.hosts.includes(host) || (host.includes('.') && trimmed.includes('/'))) {
        return `https://${trimmed}`
    }

    if (rules.profileUrl) {
        // The `@` is how people write handles; it is not part of the URL for any platform except
        // Mastodon, where it separates user from instance, and YouTube, which re-adds its own.
        const handle = kind === 'mastodon' ? trimmed.replace(/^@/, '') : trimmed.replace(/^@+/, '')
        return handle ? rules.profileUrl(handle) : undefined
    }

    // `web`: no handle form, so the value has to stand up as a host on its own.
    return host.includes('.') ? `https://${trimmed}` : undefined
}
