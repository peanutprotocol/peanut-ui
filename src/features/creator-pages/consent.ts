import { marketingQrAnalyticsAllowed } from '@/features/marketing-qr/consent'

/**
 * The consent rule of the creator page events and the variant cookie: the marketing rule (no PostHog
 * key, Do Not Track, Global Privacy Control or a PostHog opt-out all refuse), and nothing during a
 * prerender, which the visitor has not seen yet.
 */
export function creatorPageAnalyticsAllowed(): boolean {
    return (
        typeof document !== 'undefined' &&
        !(document as Document & { prerendering?: boolean }).prerendering &&
        marketingQrAnalyticsAllowed()
    )
}
