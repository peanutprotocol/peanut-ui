/**
 * Single source of truth for building `/api/og` social-preview image URLs.
 *
 * The query-param contract lives here and in the image renderer at
 * `src/app/api/og/route.tsx` — keep the param names in the two in sync. Every
 * page that needs a dynamic OG image (claim, the `[...recipient]`
 * payment/profile page, receipts, invites) builds its URL through this helper,
 * so a change to the contract happens in one place instead of N.
 */
export type OgImageParams = {
    type?: 'send' | 'request' | 'generic'
    username?: string
    /** Token amount as a display string/number; omitted from the URL when empty. */
    amount?: string | number
    /** Token symbol, e.g. USDC. */
    token?: string
    /** Render the already-paid / claimed "receipt" variant. */
    isReceipt?: boolean
    /** Mark the recipient as a Peanut handle (profile styling). */
    isPeanutUsername?: boolean
    /** Render the invite variant. */
    isInvite?: boolean
}

/** Build an absolute `/api/og` image URL from the given params and site origin. */
export function buildOgImageUrl(params: OgImageParams, siteUrl: string): string {
    const url = new URL('/api/og', siteUrl)

    if (params.type) url.searchParams.set('type', params.type)
    if (params.username) url.searchParams.set('username', params.username)
    if (params.amount !== undefined && params.amount !== null && params.amount !== '') {
        url.searchParams.set('amount', String(params.amount))
    }
    if (params.token) url.searchParams.set('token', params.token)
    if (params.isReceipt) url.searchParams.set('isReceipt', 'true')
    if (params.isPeanutUsername) url.searchParams.set('isPeanutUsername', 'true')
    if (params.isInvite) url.searchParams.set('isInvite', 'true')

    return url.toString()
}
