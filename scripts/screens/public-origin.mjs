export function normalizePublicOrigin(value) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
        throw new Error('Store URL must be an HTTPS origin')
    return url.origin
}
