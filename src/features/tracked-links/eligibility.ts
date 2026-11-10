import { marketingQrAnalyticsAllowed } from '@/features/marketing-qr/consent'
import { isInviteUsername } from './contract'

/** Descriptor resolution owns these entries, before any default journey write. */
export function isTrackedLinkEntry(): boolean {
    if (typeof window === 'undefined') return false
    const url = new URL(window.location.href)
    const pathname = url.pathname.replace(/\/$/, '') || '/'
    const codes = url.searchParams.getAll('code')
    const legacyCreator =
        codes.length === 1 &&
        isInviteUsername(codes[0]) &&
        (pathname === '/app' || (pathname === '/home' && url.searchParams.get('app_entry') === '1'))
    return (
        legacyCreator ||
        pathname.startsWith('/go/') ||
        (['/app', '/home'].includes(pathname) && (url.searchParams.has('tl') || url.searchParams.has('tracked_link')))
    )
}

export function trackedLinkAnalyticsAllowed(): boolean {
    return (
        typeof document !== 'undefined' &&
        !(document as Document & { prerendering?: boolean }).prerendering &&
        marketingQrAnalyticsAllowed()
    )
}
