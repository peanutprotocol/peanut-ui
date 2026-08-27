/**
 * Support-facing account context — the state a Crisp agent needs so a
 * conversation doesn't open with five rounds of "what's your balance / what did
 * you last do / which app are you on". Follow-up to the verification snapshot
 * (#2360), same destination: Crisp `session:data`, the agent-only sidebar.
 *
 * Two invariants hold for everything in this file:
 *
 *  1. **No new reads.** Every value is derived from data the client already
 *     holds — the `/get-user` read-models and warm react-query caches. Crisp
 *     has no database access and gains none here; the client pushes what it
 *     already knows.
 *  2. **The user's own state, never a counterparty's.** Activity summaries name
 *     the kind, status and amount — never who was paid. A support console is
 *     the wrong place to accumulate third parties' payment histories.
 */

import { formatUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { computeDisplaySpendable, isRainBalanceKnown, rainCentsToUsdcUnits } from '@/utils/balance.utils'
import { formatCurrency } from '@/utils/general.utils'
import {
    ARBISCAN_ADDRESS_BASE_URL,
    BRIDGE_DASHBOARD_BASE_URL,
    POSTHOG_PERSON_BASE_URL,
    SENTRY_USER_ISSUES_BASE_URL,
} from '@/constants/support'
import { type Account, AccountType, type IUserProfile } from '@/interfaces/interfaces'
import type { RainCardOverview } from '@/services/rain'

const usd = (units: bigint): string => `$${formatCurrency(formatUnits(units, PEANUT_WALLET_TOKEN_DECIMALS))}`

const usdFromCents = (cents: number | null | undefined): string => usd(rainCentsToUsdcUnits(cents))

/** Compact age of a past timestamp: "3h", "2d", "5m". Undefined for absent/invalid input. */
export function relativeAge(value: Date | string | undefined, now: number = Date.now()): string | undefined {
    if (!value) return undefined
    const ms = now - new Date(value).getTime()
    if (!Number.isFinite(ms)) return undefined
    const minutes = Math.floor(ms / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
}

/**
 * Spendable balance for the sidebar, with the two halves reported separately.
 *
 * An unreadable balance MUST NOT print as `$0.00`. `rainCentsToUsdcUnits(undefined)`
 * is `0n`, so "no answer" and "genuinely empty" are arithmetically identical —
 * the $0-balance bug (PEANUT-UI-QD5). An agent reading `$0.00` tells a funded
 * user they have no money, which is worse than telling them nothing. So each
 * half is either a figure or the word `unavailable`, and the total only appears
 * when both halves are answers.
 */
export function buildBalanceSummary(
    smartBalance: bigint | undefined,
    rainOverview: RainCardOverview | undefined
): string | undefined {
    const walletKnown = smartBalance !== undefined
    const cardKnown = isRainBalanceKnown(rainOverview)
    if (!walletKnown && !cardKnown) return 'unavailable — no balance reading on this device yet'

    const wallet = walletKnown ? usd(smartBalance) : 'unavailable'
    const spendingPower = rainOverview?.balance?.spendingPower
    const card = cardKnown ? usdFromCents(spendingPower) : 'unavailable'
    const halves = `wallet ${wallet} · card ${card}`

    if (!walletKnown || !cardKnown) return `${halves} — total unknown`

    const total = computeDisplaySpendable(
        smartBalance,
        spendingPower,
        rainOverview?.balance?.inTransitToCollateralCents
    )
    return `${usd(total)} spendable (${halves})`
}

/** Points, streak, tenure and invite provenance — all already on /get-user. */
export function buildAccountStats(profile: IUserProfile | undefined, now: number = Date.now()): string | undefined {
    if (!profile) return undefined
    const parts: string[] = [`${profile.totalPoints ?? 0} pts`]
    if (profile.streak) parts.push(`${profile.streak}d streak`)

    const age = relativeAge(profile.user?.createdAt, now)
    if (age) parts.push(`joined ${age} ago`)
    if (profile.user?.activationMilestone) parts.push(`milestone:${profile.user.activationMilestone}`)
    // `invitedBy` is another person's username. Whether the user was referred is
    // useful to an agent; who referred them is a third party's identifier, and
    // this module never sends one.
    if (profile.invitedBy) parts.push('referred:yes')
    if (profile.invitesSent?.length) parts.push(`invites_sent:${profile.invitesSent.length}`)

    const badges = profile.user?.badges?.map((badge) => badge.code).filter(Boolean) ?? []
    if (badges.length) parts.push(`badges:${badges.join('/')}`)

    const queuePosition = profile.pwQueue?.userPosition
    if (queuePosition != null) parts.push(`queue:${queuePosition}/${profile.pwQueue?.totalUsers ?? '?'}`)

    return parts.join(' · ')
}

/** Card application state and collateral, for the card half of support volume. */
export function buildCardSummary(overview: RainCardOverview | undefined): string | undefined {
    if (!overview) return undefined
    if (!overview.status?.hasApplication) return 'no application'

    const parts: string[] = []
    if (overview.status.applicationStatus) parts.push(`application:${overview.status.applicationStatus}`)
    if (overview.status.railStatus) parts.push(`rail:${overview.status.railStatus}`)

    if (isRainBalanceKnown(overview) && overview.balance) {
        parts.push(`limit ${usdFromCents(overview.balance.creditLimit)}`)
        parts.push(`due ${usdFromCents(overview.balance.balanceDue)}`)
    } else {
        parts.push('balance unavailable')
    }

    const cards = overview.cards ?? []
    if (cards.length) {
        parts.push(cards.map((card) => `··${card.last4}:${card.status}`).join(' '))
    }

    return parts.join(' · ')
}

/**
 * Which payout rails the user has attached, as shapes only — `iban:DE`, never
 * the IBAN. An agent needs to know a bank account exists and where it is; the
 * number itself has no place in a chat console.
 */
export function buildLinkedAccounts(accounts: Account[] | undefined): string | undefined {
    if (!accounts?.length) return undefined
    const shapes = accounts.map((account) => {
        const country = account.details?.countryCode
        return account.type === AccountType.PEANUT_WALLET || !country ? account.type : `${account.type}:${country}`
    })
    return Array.from(new Set(shapes)).join(' · ')
}

export interface SupportSegmentInput {
    isLoggedIn: boolean
    platform: string
    identityStatus: string | undefined
    hasFailureReason: boolean
    emailOnFile: boolean | undefined
    hasCard: boolean
    balanceKnown: boolean
    isZeroBalance: boolean
    isOffline: boolean
    isApiUnreachable: boolean
}

/**
 * Crisp segments — the boolean half of the picture.
 *
 * Segments are filterable and routable in the Crisp inbox, which is what you
 * actually want for yes/no facts; `session:data` rows are for values an agent
 * reads. Putting the booleans here is also what keeps the sidebar from growing
 * into a wall of `yes`/`no` rows nobody scrolls to the bottom of.
 */
export function buildSupportSegments(input: SupportSegmentInput): string[] {
    const segments: string[] = [input.platform]

    if (!input.isLoggedIn) {
        segments.push('guest')
        return segments
    }

    if (input.identityStatus) segments.push(`kyc-${input.identityStatus}`)
    if (input.hasFailureReason) segments.push('verification-blocked')
    if (input.emailOnFile === false) segments.push('no-email')
    if (input.hasCard) segments.push('card-holder')
    if (!input.balanceKnown) segments.push('balance-unavailable')
    else if (input.isZeroBalance) segments.push('zero-balance')
    if (input.isOffline) segments.push('offline')
    if (input.isApiUnreachable) segments.push('api-unreachable')

    return segments
}

export interface SupportLinks {
    walletAddressLink: string | undefined
    bridgeCustomerLink: string | undefined
    posthogPersonLink: string | undefined
    sentryIssuesLink: string | undefined
}

/** The dashboards an agent opens in another tab, built from ids the client holds. */
export function buildSupportLinks(
    userId: string | undefined,
    walletAddress: string | undefined,
    bridgeCustomerId: string | undefined
): SupportLinks {
    return {
        walletAddressLink: walletAddress ? `${ARBISCAN_ADDRESS_BASE_URL}/${walletAddress}` : undefined,
        bridgeCustomerLink: bridgeCustomerId ? `${BRIDGE_DASHBOARD_BASE_URL}/${bridgeCustomerId}` : undefined,
        posthogPersonLink: userId ? `${POSTHOG_PERSON_BASE_URL}/${userId}` : undefined,
        sentryIssuesLink: userId ? `${SENTRY_USER_ISSUES_BASE_URL}:${userId}` : undefined,
    }
}

/** Platform, build, locale, route and connectivity as one row. */
export function buildAppContext(client: {
    platform: string
    appBuild: string
    locale: string
    routeOnOpen: string | undefined
    isOffline: boolean
    isApiUnreachable: boolean
    notificationPermission: string
}): string {
    return [
        client.platform,
        client.appBuild,
        `locale:${client.locale}`,
        client.routeOnOpen ? `route:${client.routeOnOpen}` : undefined,
        client.isOffline ? 'offline' : client.isApiUnreachable ? 'api-unreachable' : 'online',
        `notif:${client.notificationPermission}`,
    ]
        .filter(Boolean)
        .join(' · ')
}

/*
 * Route segments that name a person or a specific object. `/pay/bob` tells a
 * support agent who the user was paying, which is the counterparty leak this
 * module exists to prevent — the same reason activity summaries carry no
 * usernames. The route is worth having ("where were they when it broke"); the
 * identifier in it is not.
 */
const IDENTIFIER_PREFIXES = new Set([
    'pay',
    'send',
    'request',
    'pay-request',
    'receipt',
    'qr',
    'qr-pay',
    'quests',
    'profile',
    'claim',
    'invite',
    'm',
])

/*
 * Top-level segments that are real pages rather than a username. The root
 * `[...recipient]` catch-all means ANY unlisted single segment may be a
 * person's handle, so anything missing here degrades to `/:recipient` — a lost
 * detail, never a leaked name. Fail-safe by construction: forgetting to add a
 * new static route costs precision, not privacy.
 */
const STATIC_ROOT_SEGMENTS = new Set([
    'home',
    'history',
    'settings',
    'card',
    'card-payment',
    'card-recovery',
    'add-money',
    'withdraw',
    'badges',
    'points',
    'rewards',
    'notifications',
    'limits',
    'kyc',
    'setup',
    'dev',
    'careers',
    'jobs',
    'lp',
    'maintenance',
    'recover-funds',
    'recover-wallet',
    'fix-card-signature',
    'crisp-proxy',
    'press',
    'status',
    'blog',
    'help',
    'compare',
    'pricing',
    'terms',
    'privacy',
    'app',
    'shhhhh',
])

const LOCALE_SEGMENTS = new Set(['en', 'es-419', 'es-ar', 'es-es', 'pt-br'])

/**
 * The route an agent can read without learning who the user was dealing with.
 *
 * `/pay/bob` → `/pay/:id`, `/bob` → `/:recipient`, `/withdraw/manteca` unchanged —
 * the provider is the useful half of that one and names nobody.
 */
export function normalizeSupportRoute(pathname: string | undefined): string | undefined {
    if (!pathname) return undefined

    const segments = pathname.split('/').filter(Boolean)
    if (segments[0] && LOCALE_SEGMENTS.has(segments[0])) segments.shift()
    if (!segments.length) return '/'

    const [head, ...rest] = segments
    if (IDENTIFIER_PREFIXES.has(head)) return rest.length ? `/${head}/:id` : `/${head}`
    if (!STATIC_ROOT_SEGMENTS.has(head)) return '/:recipient'
    return `/${[head, ...rest].join('/')}`
}

/*
 * URLs in a support message, reduced to what an agent needs and nothing else.
 *
 * Two kinds of secret ride in a URL here. The fragment is one: a claim link is
 * `/claim?c=…&v=…&i=…#p=<password>` (history.utils), and that password is a
 * bearer credential — it derives the private claim key, so whoever holds it can
 * take the funds. The query is the other: an OAuth callback carries `?code=`,
 * a magic link carries `?token=`, and not-found.tsx already sends a bare
 * pathname for exactly that reason.
 *
 * So the default is to drop both, and the query is kept only where it is known
 * to identify rather than authorize. `/claim` is that case: `c`, `v` and `i`
 * locate the deposit on-chain and are what let an agent find the link at all.
 *
 * Deny-lists were the alternative and were rejected: a list of secret-looking
 * parameter names has to be right about every page that exists now and every
 * one added later. This is wrong in the safe direction — an unlisted page loses
 * context, never a credential.
 *
 * Call sites hand over `window.location.href` (ClaimErrorView,
 * Error.validation.view), and `ModalsContext` runs every prefill through this
 * before storing it, so the composer and the `support_topic` row are both
 * covered — including call sites nobody has written yet.
 */
const URL_IN_TEXT = /https?:\/\/\S+/g

/** Paths whose query identifies a thing rather than authorizing access to it. */
const QUERY_BEARING_PATHS = ['/claim']

export function redactSupportText(text: string): string {
    if (!text) return text
    return text.replace(URL_IN_TEXT, (raw) => {
        let url: URL
        try {
            url = new URL(raw)
        } catch {
            // Not parseable as a URL, so nothing can be reasoned about it.
            return '[link removed]'
        }
        const keepsQuery = QUERY_BEARING_PATHS.some((path) => url.pathname === path || url.pathname.endsWith(path))
        return `${url.origin}${url.pathname}${keepsQuery ? url.search : ''}`
    })
}
