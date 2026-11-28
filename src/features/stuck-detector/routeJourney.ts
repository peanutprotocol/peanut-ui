import type { StuckJourney, StuckSurface } from './types'

const BLOCKED_PREFIXES = ['/support', '/crisp-proxy', '/dev', '/shhhhh', '/admin', '/payment-explorer']

function hasSegmentPrefix(pathname: string, prefix: string): boolean {
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Whether proactive stuck nudges are completely disallowed on this pathname. */
export function isStuckExcludedPath(pathname: string): boolean {
    if (!pathname) return true
    return BLOCKED_PREFIXES.some((prefix) => hasSegmentPrefix(pathname, prefix))
}

/** Map a Next.js pathname to Peanut's journey taxonomy (segment-safe, never prefix-colliding). */
export function journeyForPath(pathname: string): StuckJourney {
    if (hasSegmentPrefix(pathname, '/setup')) return 'signup'
    if (hasSegmentPrefix(pathname, '/verify')) return 'kyc'
    if (hasSegmentPrefix(pathname, '/add-money')) return 'deposit'
    if (hasSegmentPrefix(pathname, '/qr-pay')) return 'qr_pay'
    if (hasSegmentPrefix(pathname, '/withdraw')) return 'withdraw'
    if (pathname === '/card' || hasSegmentPrefix(pathname, '/card/apply')) return 'card'
    if (hasSegmentPrefix(pathname, '/send') || pathname === '/pay' || hasSegmentPrefix(pathname, '/pay/')) {
        return 'send'
    }
    if (hasSegmentPrefix(pathname, '/profile/accounts')) return 'account_setup'
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
    return hasSegmentPrefix(clean, '/add-money/crypto') || hasSegmentPrefix(clean, '/add-money/pix')
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
 * Map a pathname + activation state to an eligible surface using exact segment checks.
 * Never catches unrelated siblings such as `/card-payment`, `/card-recovery`, or `/card/pin`.
 */
export function surfaceForPath(pathname: string, hasSpent: boolean): StuckSurface | null {
    if (isStuckExcludedPath(pathname)) return null
    if (hasSegmentPrefix(pathname, '/setup')) return 'setup_passkey'
    if (hasSegmentPrefix(pathname, '/verify')) return 'verify_loop'
    if (isBankDepositPath(pathname)) return hasSpent ? 'active_issue' : 'add_money'
    if (isNonBankDepositRailPath(pathname)) return 'active_issue'
    if (pathname === '/home') return hasSpent ? 'home_wave' : 'home_funded'
    if (hasSegmentPrefix(pathname, '/qr-pay') || hasSegmentPrefix(pathname, '/withdraw') || pathname === '/card') {
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
        raw === 'home_wave' ||
        raw === 'active_issue'
    ) {
        return raw
    }
    return null
}
