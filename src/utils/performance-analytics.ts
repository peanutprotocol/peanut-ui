import { redactNativePath } from './native-routes'

const API_SAMPLE_RATE = 0.1
export const API_SLOW_THRESHOLD_MS = 2_000

const API_STATIC_SEGMENTS = new Set([
    'accounts',
    'auth',
    'balance',
    'bank',
    'card',
    'cards',
    'cash-status',
    'capabilities',
    'claim',
    'contacts',
    'crypto',
    'deposits',
    'fx',
    'healthz',
    'history',
    'invites',
    'me',
    'notifications',
    'payments',
    'perks',
    'points',
    'rain',
    'rates',
    'receipts',
    'rewards',
    'send-links',
    'status',
    'transactions',
    'user-graph',
    'users',
    'withdrawals',
])

/**
 * Low-cardinality API route template for analytics. Query/fragment values are
 * always discarded and any path segment outside the explicit route vocabulary
 * becomes :id, so usernames, addresses, UUIDs and provider ids cannot leak.
 */
export function apiRouteTemplate(path: string): string {
    const pathname = path.split('#')[0].split('?')[0]
    const segments = pathname.split('/')
    return segments.map((segment) => (!segment || API_STATIC_SEGMENTS.has(segment) ? segment : ':id')).join('/') || '/'
}

/** Stable screen name including only UI state whose values are enumerated. */
export function screenTemplate(pathname: string, search = ''): string {
    const route = redactNativePath(pathname)
    const params = new URLSearchParams(search)

    if (route === '/home') {
        const drawer = params.get('drawer')
        if (drawer === 'add' || drawer === 'send') return `${route}#${drawer}`
    }

    if (route === '/add-money') {
        if (params.get('method') === 'bank') return `${route}#bank`
        const country = params.get('country')
        const view = params.get('view')
        if (country) return `${route}/:id${view === 'bank' || view === 'manteca' ? `/${view}` : ''}`
    }

    if (route === '/withdraw') {
        const country = params.get('country')
        const view = params.get('view')
        if (country) return `${route}/:id${view === 'bank' ? '/bank' : ''}`
    }

    // Native static-export stand-ins for dynamic web routes. Values are never
    // included; the template only records that a dynamic destination exists.
    if (route === '/send' && params.has('recipient')) return '/send/:id'
    if (route === '/request' && params.has('recipient')) return '/request/:id'
    if (route === '/profile/view' && params.has('username')) return '/profile/:id'
    if (route === '/receipt' && params.has('id')) return '/receipt/:id'

    return route
}

export function shouldSampleApiRequest(random: () => number = Math.random): boolean {
    return random() < API_SAMPLE_RATE
}

export function parseServerTiming(value: string | null): number | undefined {
    if (!value) return undefined
    const match = value.match(/(?:^|,)\s*app;dur=([0-9]+(?:\.[0-9]+)?)(?:\s|,|$)/i)
    if (!match) return undefined
    const duration = Number(match[1])
    return Number.isFinite(duration) ? duration : undefined
}
