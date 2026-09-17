import { redactNativePath } from './native-routes'

const API_SAMPLE_RATE = 0.1
export const API_SLOW_THRESHOLD_MS = 2_000

type ApiRoutePattern = readonly [pattern: RegExp, template: string | ((match: RegExpMatchArray) => string)]

// Dynamic values are redacted by their position in a known endpoint shape.
// This avoids both failure modes of a global segment vocabulary: an identifier
// such as the username "bank" leaking as if it were syntax, and real endpoint
// words such as bridge/onramp/create collapsing into anonymous ids.
const API_ROUTE_PATTERNS: readonly ApiRoutePattern[] = [
    [/^\/users\/username\/[^/]+$/, '/users/username/:username'],
    [/^\/users\/identity\/sessions\/[^/]+$/, '/users/identity/sessions/:sessionId'],
    [/^\/users\/saved-addresses\/[^/]+$/, '/users/saved-addresses/:addressId'],
    [/^\/users\/[^/]+\/rewards$/, '/users/:userId/rewards'],
    [/^\/users\/[^/]+$/, '/users/:userId'],
    [/^\/bridge\/onramp\/[^/]+\/cancel$/, '/bridge/onramp/:transferId/cancel'],
    [/^\/bridge\/customers\/[^/]+\/external-accounts$/, '/bridge/customers/:customerId/external-accounts'],
    [/^\/bridge\/customers\/[^/]+$/, '/bridge/customers/:customerId'],
    [/^\/bridge\/transfers\/[^/]+\/confirm$/, '/bridge/transfers/:transferId/confirm'],
    [/^\/manteca\/deposit\/[^/]+\/(status|cancel)$/, (match) => `/manteca/deposit/:depositId/${match[1]}`],
    [
        /^\/rain\/cards\/[^/]+\/(activate|lock|cancel|cancellation-feedback|details|provisioning-data|provisioning-authorization|limits|pin|physical-waitlist)$/,
        (match) => `/rain/cards/:cardId/${match[1]}`,
    ],
    [/^\/rain\/cards\/[^/]+$/, '/rain/cards/:cardId'],
    [/^\/rhino\/(status|reset-status)\/[^/]+$/, (match) => `/rhino/${match[1]}/:depositAddress`],
    [/^\/ens\/reverse\/[^/]+$/, '/ens/reverse/:address'],
    [/^\/ens\/[^/]+$/, '/ens/:name'],
    [/^\/qr\/[^/]+\/claim$/, '/qr/:code/claim'],
    [/^\/qr\/[^/]+$/, '/qr/:code'],
    [/^\/charges\/[^/]+\/payments$/, '/charges/:chargeId/payments'],
    [/^\/charges\/[^/]+$/, '/charges/:chargeId'],
    [/^\/request-charges\/[^/]+$/, '/request-charges/:chargeId'],
    [/^\/requests\/[^/]+$/, '/requests/:requestId'],
    [/^\/send-links\/claim\/[^/]+\/associate-user$/, '/send-links/claim/:txHash/associate-user'],
    [/^\/send-links\/[^/]+\/status$/, '/send-links/:publicKey/status'],
    [/^\/send-links\/[^/]+$/, '/send-links/:publicKey'],
    [/^\/history\/[^/]+$/, '/history/:entryId'],
]

// Only whole, known-static routes are retained. Unknown shapes collapse to a
// single bucket instead of risking raw usernames, addresses or provider ids.
const API_STATIC_ROUTES = new Set([
    '/add-account',
    '/auth/step-up/options',
    '/auth/step-up/verify',
    '/badge/award',
    '/badge/catalog',
    '/badge/claims',
    '/badge/team',
    '/bridge/exchange-rate',
    '/bridge/offramp/create',
    '/bridge/offramp/create-for-guest',
    '/bridge/onramp/create',
    '/bridge/onramp/quote',
    '/card',
    '/charges',
    '/config/residence-restrictions',
    '/fx/card-markup',
    '/fx/rate',
    '/get-user-id',
    '/invites/accept',
    '/invites/user-graph',
    '/invites/validate',
    '/invites/waitlist-position',
    '/is-valid-bic',
    '/manteca/deposit',
    '/manteca/prices',
    '/manteca/qr-payment/complete-with-signed-tx',
    '/manteca/qr-payment/init',
    '/manteca/withdraw',
    '/manteca/withdraw/complete-with-signed-tx',
    '/manteca/withdraw/init',
    '/notifications/mark-read',
    '/notifications/unread-count',
    '/perks/claim',
    '/perks/pending',
    '/points',
    '/points/calculate',
    '/points/cash-status',
    '/points/invites',
    '/rain/cards',
    '/rain/cards/readiness',
    '/rain/cards/recover-funds/prepare',
    '/rain/cards/recover-funds/preview',
    '/rain/cards/session-key-address',
    '/rain/cards/withdraw/prepare',
    '/rain/cards/withdraw/prepare/cancel',
    '/rain/cards/withdraw/session-approve',
    '/rain/cards/withdraw/stamp',
    '/rain/cards/withdraw/submit',
    '/requests',
    '/rhino/deposit',
    '/rhino/request-fulfilment',
    '/send-links',
    '/tokens/price',
    '/tokens/wallet-portfolio',
    '/update-user',
    '/user/crisp-token',
    '/users/accounts',
    '/users/bridge-tos-confirm',
    '/users/bridge-tos-link',
    '/users/capabilities',
    '/users/consent/accept',
    '/users/consent/status',
    '/users/contacts',
    '/users/email-change',
    '/users/history',
    '/users/identity',
    '/users/identity/restart',
    '/users/identity/resubmit',
    '/users/identity/session-token',
    '/users/increase-limits',
    '/users/initiate-kyc',
    '/users/interaction-status',
    '/users/kyc/start-action',
    '/users/limits',
    '/users/logout',
    '/users/me',
    '/users/me/delete',
    '/users/residence-change/start',
    '/users/saved-addresses',
    '/users/username/check',
    '/validate-bank-account-number',
])

/**
 * Low-cardinality API route template for analytics. Query/fragment values are
 * discarded, dynamic positions in known routes get named placeholders, and
 * unknown shapes share one fixed fallback so identifiers cannot leak.
 */
export function apiRouteTemplate(path: string): string {
    const rawPathname = path.split('#')[0].split('?')[0]
    const pathname = rawPathname.replace(/\/+$/, '') || '/'

    for (const [pattern, template] of API_ROUTE_PATTERNS) {
        const match = pathname.match(pattern)
        if (match) return typeof template === 'string' ? template : template(match)
    }

    return API_STATIC_ROUTES.has(pathname) ? pathname : '/unmatched'
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
