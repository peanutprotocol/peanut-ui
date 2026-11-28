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
 * Normalize Capacitor native static-export query-param deposit routes
 * (`/add-money?country=germany&view=bank`, `/add-money?country=argentina&view=manteca`)
 * into their canonical path form (`/add-money/germany/bank`, `/add-money/argentina/manteca`).
 * Pickers (`/add-money`, `/add-money?country=austria`, `/add-money?method=bank`) stay `/add-money`.
 */
export function canonicalStuckRoute(pathname: string, country?: string | null, view?: string | null): string {
    const [rawPath, rawQuery] = pathname.split('?')
    const cleanPath = rawPath.replace(/\/+$/, '') || '/'
    if (cleanPath === '/add-money') {
        let resolvedCountry = country?.trim().toLowerCase() || ''
        let resolvedView = view?.trim().toLowerCase() || ''
        if ((!resolvedCountry || !resolvedView) && rawQuery) {
            const params = new URLSearchParams(rawQuery)
            resolvedCountry = resolvedCountry || params.get('country')?.trim().toLowerCase() || ''
            resolvedView = resolvedView || params.get('view')?.trim().toLowerCase() || ''
        }
        if (resolvedCountry && (resolvedView === 'bank' || resolvedView === 'manteca')) {
            return `/add-money/${resolvedCountry}/${resolvedView}`
        }
    }
    return cleanPath
}

/** Whether a path is a non-bank direct deposit rail (crypto or Pix). */
export function isNonBankDepositRailPath(pathname: string): boolean {
    const clean = canonicalStuckRoute(pathname)
    return (
        clean === '/add-money/crypto' ||
        clean.startsWith('/add-money/crypto/') ||
        clean === '/add-money/pix' ||
        clean.startsWith('/add-money/pix/')
    )
}

/**
 * Whether a path is an actual bank-transfer deposit flow (`/add-money/<country>/bank`,
 * non-BRL `/add-money/<country>/manteca`, or their native `?country=...&view=bank|manteca` equivalents).
 * Excludes method/country pickers (`/add-money`, `/add-money/options`, `/add-money/<country>`),
 * crypto (`/add-money/crypto`), and Pix (`/add-money/pix`, `/add-money/brazil/manteca`).
 */
export function isBankDepositPath(pathname: string): boolean {
    const clean = canonicalStuckRoute(pathname)
    const parts = clean.split('/').filter(Boolean)
    if (parts.length !== 3 || parts[0] !== 'add-money') return false
    const [, country, rail] = parts
    if (rail === 'bank') return true
    if (rail === 'manteca' && country !== 'brazil' && country !== 'br') return true
    return false
}

/**
 * Map a pathname + activation state to one of the 5 eligible intervention surfaces.
 * Card terms, marketing pages, and add-money pickers are excluded; crypto and Pix use active_issue.
 */
export function surfaceForPath(pathname: string, hasSpent: boolean): StuckSurface | null {
    if (isStuckExcludedPath(pathname)) return null
    if (pathname.startsWith('/setup')) return 'setup_passkey'
    if (pathname.startsWith('/verify')) return 'verify_loop'
    if (isBankDepositPath(pathname)) return hasSpent ? 'active_issue' : 'add_money'
    if (isNonBankDepositRailPath(pathname)) return 'active_issue'
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
