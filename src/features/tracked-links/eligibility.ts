import { marketingQrAnalyticsAllowed } from '@/features/marketing-qr/consent'
import { isAcquisitionSlug } from './contract'

/**
 * The one tracked-entry detector: /go's handoff (`tl`) or a distributed legacy `/app?code=<username>`.
 * The bootstrap owns these entries, so default attribution capture stays out of them.
 */
export function isTrackedLinkEntry({ pathname, search }: { pathname: string; search: string }): boolean {
    if (pathname.replace(/\/$/, '') !== '/app') return false
    const params = new URLSearchParams(search)
    return params.has('tl') || isAcquisitionSlug(params.get('code')?.toLowerCase())
}

export function trackedLinkAnalyticsAllowed(): boolean {
    return (
        typeof document !== 'undefined' &&
        !(document as Document & { prerendering?: boolean }).prerendering &&
        marketingQrAnalyticsAllowed()
    )
}
