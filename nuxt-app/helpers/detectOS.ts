export type OS = 'iOS' | 'Android' | 'macOS' | 'Windows' | 'Linux' | 'ChromeOS' | 'Unknown'

export function getOS(userAgent: string): OS {
    if (!userAgent) {
        return 'Unknown'
    }

    const ua = userAgent.toLowerCase()

    if (/iphone|ipad|ipod/.test(ua)) {
        return 'iOS'
    }

    if (/android/.test(ua)) {
        return 'Android'
    }

    if (/macintosh|mac os x/.test(ua)) {
        return 'macOS'
    }

    if (/windows/.test(ua)) {
        return 'Windows'
    }

    if (/cros/.test(ua)) {
        return 'ChromeOS'
    }

    if (/linux/.test(ua)) {
        return 'Linux'
    }

    return 'Unknown'
}
