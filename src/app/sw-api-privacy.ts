import { PEANUT_API_URL } from '../constants/api-url.consts'

/**
 * API responses carry personal data (KYC answers include the tax number and address). serwist's
 * default cross-origin rule would cache them for an hour ignoring `no-store`, past sign-out.
 */
export function isPeanutApiUrl(url: URL | string, apiBaseUrl: string = PEANUT_API_URL): boolean {
    let base: URL
    let target: URL
    try {
        base = new URL(apiBaseUrl)
        target = typeof url === 'string' ? new URL(url) : url
    } catch {
        return false
    }
    if (target.origin !== base.origin) return false
    const basePath = base.pathname.replace(/\/$/, '')
    return basePath === '' || target.pathname === basePath || target.pathname.startsWith(`${basePath}/`)
}
