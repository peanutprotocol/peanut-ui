import type { StuckJourney, StuckSurface } from './types'

const BLOCKED_PREFIXES = ['/support', '/crisp-proxy', '/dev', '/shhhhh', '/admin', '/payment-explorer']

/** Whether proactive stuck nudges are completely disallowed on this pathname. */
export function isStuckExcludedPath(pathname: string): boolean {
    if (!pathname) return true
    return BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** Map a Next.js pathname to the model's journey taxonomy. */
export function journeyForPath(pathname: string): StuckJourney {
    if (pathname.startsWith('/setup')) return 'signup'
    if (pathname.startsWith('/verify')) return 'kyc'
    if (pathname.startsWith('/add-money')) return 'deposit'
    if (pathname.startsWith('/qr-pay')) return 'qr_pay'
    if (pathname.startsWith('/withdraw')) return 'withdraw'
    if (pathname.startsWith('/card')) return 'card'
    if (pathname.startsWith('/send') || pathname.startsWith('/pay')) return 'send'
    if (pathname.startsWith('/profile/accounts')) return 'account_setup'
    return 'other'
}

/**
 * Map a pathname + activation state to one of the 5 eligible intervention surfaces.
 * Card terms and marketing pages are deliberately excluded.
 */
export function surfaceForPath(pathname: string, hasSpent: boolean): StuckSurface | null {
    if (isStuckExcludedPath(pathname)) return null
    if (pathname.startsWith('/setup')) return 'setup_passkey'
    if (pathname.startsWith('/verify')) return 'verify_loop'
    if (pathname.startsWith('/add-money')) return hasSpent ? 'active_issue' : 'add_money'
    if (pathname === '/home') return hasSpent ? null : 'home_funded'
    if (pathname.startsWith('/qr-pay') || pathname.startsWith('/withdraw') || pathname.startsWith('/card')) {
        return 'active_issue'
    }
    return null
}

/** Parse optional non-prod `?stuck_demo=<surface>` query parameter for QA and design review. */
export function parseDemoSurface(search: string, allowDemo: boolean): StuckSurface | null {
    if (!allowDemo || !search) return null
    const params = new URLSearchParams(search)
    const raw = params.get('stuck_demo')
    if (
        raw === 'add_money' ||
        raw === 'verify_loop' ||
        raw === 'setup_passkey' ||
        raw === 'home_funded' ||
        raw === 'active_issue'
    ) {
        return raw
    }
    return null
}
