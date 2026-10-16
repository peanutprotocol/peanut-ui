const QR_REDIRECT_HOSTS = new Set(['peanut.me', 'www.peanut.me', 'staging.peanut.me', 'dev.peanut.me'])

/** Absolute QR destinations must belong to an explicitly supported HTTPS origin. */
export function parseQrRedirectUrl(target: string): URL | null {
    try {
        const url = new URL(target)
        if (url.username || url.password || /[\\\u0000-\u0020]/.test(target)) return null
        const local = process.env.NODE_ENV !== 'production' && url.hostname === 'localhost'
        if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
        const configured = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me')
        const supported =
            (QR_REDIRECT_HOSTS.has(url.hostname) && !url.port) ||
            (configured.protocol === 'https:' && url.origin === configured.origin) ||
            local
        if (!supported) return null
        const path = decodeURIComponent(url.pathname)
        if (/^\/[\\/]/.test(path) || new URL(path, url.origin).origin !== url.origin) return null
        return url
    } catch {
        return null
    }
}
