import {
    buildAccountStats,
    buildBalanceSummary,
    buildCardSummary,
    buildLatestActivity,
    buildLimitsSummary,
    buildLinkedAccounts,
    buildSupportSegments,
    normalizeSupportRoute,
    relativeAge,
} from '../support-context'
import { AccountType, type Account, type IUserProfile } from '@/interfaces/interfaces'
import type { RainCardOverview } from '@/services/rain'
import type { HistoryEntry } from '@/utils/history.utils'

const NOW = new Date('2026-08-27T12:00:00Z').getTime()

const overview = (partial: Partial<RainCardOverview> = {}): RainCardOverview =>
    ({
        status: { hasApplication: true, applicationStatus: 'approved', railStatus: 'ENABLED' },
        balance: { creditLimit: 50_000, spendingPower: 2_345, pendingCharges: 0, postedCharges: 0, balanceDue: 0 },
        cards: [],
        ...partial,
    }) as RainCardOverview

describe('buildBalanceSummary', () => {
    it('sums the two halves when both are answers', () => {
        expect(buildBalanceSummary(100_000_000n, overview())).toBe('$123.45 spendable (wallet $100.00 · card $23.45)')
    })

    it('treats a user with no card application as a real zero, not unknown', () => {
        const noCard = overview({ status: { hasApplication: false }, balance: null })
        expect(buildBalanceSummary(100_000_000n, noCard)).toBe('$100.00 spendable (wallet $100.00 · card $0.00)')
    })

    /*
     * The $0-balance bug (PEANUT-UI-QD5) in its support-facing form: an agent
     * who reads "$0.00" tells a funded user they have no money. "unavailable"
     * is strictly better than a confident wrong number.
     */
    it('never prints $0.00 for a balance it could not read', () => {
        const unreadable = overview({ balance: null, balanceUnavailable: true })
        const summary = buildBalanceSummary(100_000_000n, unreadable)
        expect(summary).toBe('wallet $100.00 · card unavailable — total unknown')
        expect(summary).not.toContain('$0.00')
    })

    it('reports unavailable when nothing has been cached yet', () => {
        expect(buildBalanceSummary(undefined, undefined)).toBe('unavailable — no balance reading on this device yet')
    })

    it('withholds the total when only the wallet half is missing', () => {
        expect(buildBalanceSummary(undefined, overview())).toBe('wallet unavailable · card $23.45 — total unknown')
    })
})

describe('buildLatestActivity', () => {
    const entry = (partial: Partial<HistoryEntry> = {}): HistoryEntry =>
        ({
            uuid: 'tx-123',
            type: 'TRANSACTION_INTENT',
            timestamp: new Date('2026-08-27T09:00:00Z'),
            amount: '25.00',
            chainId: '42161',
            tokenSymbol: 'USDC',
            status: 'COMPLETED',
            userRole: 'SENDER',
            recipientAccount: { identifier: 'bob.eth', type: 'peanut-wallet', isUser: true, username: 'bob' },
            extraData: { kind: 'P2P_SEND' },
            ...partial,
        }) as HistoryEntry

    it('summarises kind, status, amount and age', () => {
        expect(buildLatestActivity(entry(), NOW)).toBe(
            'P2P_SEND · COMPLETED · 25.00 USDC · 3h ago · as sender · uuid:tx-123'
        )
    })

    /*
     * A support sidebar is the user's own state. Replicating who they paid would
     * accumulate third parties' payment records in a chat console — which is
     * both a privacy problem and something no agent needs to answer "where did
     * my money go".
     */
    it('never names the counterparty', () => {
        const summary = buildLatestActivity(entry(), NOW) ?? ''
        expect(summary).not.toContain('bob')
        expect(summary).not.toContain('bob.eth')
    })

    it('surfaces the reaper failure note on a failed intent', () => {
        const failed = entry({ status: 'FAILED', extraData: { kind: 'FIAT_OFFRAMP', failReason: 'provider timeout' } })
        expect(buildLatestActivity(failed, NOW)).toContain('failReason:provider timeout')
    })

    it('prefers the fiat amount when the entry carries one', () => {
        expect(buildLatestActivity(entry({ currency: { amount: '25000', code: 'ARS' } }), NOW)).toContain('25000 ARS')
    })

    it('reads as a phrase for a transaction from moments ago', () => {
        const justNow = entry({ timestamp: new Date('2026-08-27T11:59:45Z') })
        expect(buildLatestActivity(justNow, NOW)).toContain('· just now ·')
    })

    it('is undefined when no history is cached', () => {
        expect(buildLatestActivity(undefined, NOW)).toBeUndefined()
    })
})

describe('buildAccountStats', () => {
    const profile = (partial: Partial<IUserProfile> = {}): IUserProfile =>
        ({
            totalPoints: 1240,
            streak: 5,
            invitedBy: 'alice',
            invitesSent: [{ inviteeId: '1', inviteeUsername: 'bob' }],
            pwQueue: { totalUsers: 900, userPosition: 12 },
            user: {
                createdAt: '2026-08-25T12:00:00Z',
                activationMilestone: 'funded',
                badges: [
                    { code: 'early-user', name: 'Early', description: null, iconUrl: null, color: null, earnedAt: '' },
                ],
            },
            ...partial,
        }) as IUserProfile

    it('packs points, streak, tenure and provenance into one row', () => {
        expect(buildAccountStats(profile(), NOW)).toBe(
            '1240 pts · 5d streak · joined 2d ago · milestone:funded · referred:yes · invites_sent:1 · badges:early-user · queue:12/900'
        )
    })

    /*
     * `invitedBy` is another person's username. That an agent knows the user was
     * referred is useful; who referred them is a third party's identifier, and
     * this module never sends one — same rule that keeps counterparties out of
     * latest_activity.
     */
    it('says the user was referred without naming the inviter', () => {
        const stats = buildAccountStats(profile({ invitedBy: 'alice' }), NOW) ?? ''
        expect(stats).toContain('referred:yes')
        expect(stats).not.toContain('alice')
    })

    it('is undefined for a guest', () => {
        expect(buildAccountStats(undefined, NOW)).toBeUndefined()
    })
})

describe('buildLimitsSummary', () => {
    it('reports remaining headroom per provider', () => {
        const summary = buildLimitsSummary({
            bridge: { onRampPerTransaction: '10000', offRampPerTransaction: '10000', asset: 'USD' },
            manteca: [
                {
                    exchangeCountry: 'ARG',
                    type: 'EXCHANGE',
                    asset: 'ARS',
                    yearlyLimit: '12000',
                    availableYearlyLimit: '9000',
                    monthlyLimit: '1000',
                    availableMonthlyLimit: '500',
                },
            ],
        })
        expect(summary).toBe('bridge on/tx 10000 off/tx 10000 USD · manteca ARG/EXCHANGE 500/1000 mo 9000/12000 yr ARS')
    })

    it('is undefined when limits were never fetched', () => {
        expect(buildLimitsSummary(undefined)).toBeUndefined()
    })
})

describe('buildCardSummary', () => {
    it('says so plainly when there is no application', () => {
        expect(buildCardSummary(overview({ status: { hasApplication: false } }))).toBe('no application')
    })

    it('reports application state, collateral and issued cards', () => {
        const withCard = overview({
            cards: [{ last4: '1234', status: 'active' }],
        } as Partial<RainCardOverview>)
        expect(buildCardSummary(withCard)).toBe(
            'application:approved · rail:ENABLED · limit $500.00 · due $0.00 · ··1234:active'
        )
    })

    it('flags an unreadable card balance rather than reporting zero', () => {
        const summary = buildCardSummary(overview({ balance: null, balanceUnavailable: true })) ?? ''
        expect(summary).toContain('balance unavailable')
        expect(summary).not.toContain('$0.00')
    })
})

describe('buildLinkedAccounts', () => {
    const account = (type: AccountType, countryCode?: string): Account =>
        ({ type, details: countryCode ? { countryCode } : undefined }) as Account

    it('reports shapes and countries, never identifiers', () => {
        const accounts = [
            account(AccountType.PEANUT_WALLET),
            account(AccountType.IBAN, 'DE'),
            account(AccountType.IBAN, 'DE'),
        ]
        expect(buildLinkedAccounts(accounts)).toBe('peanut-wallet · iban:DE')
    })

    it('is undefined when nothing is linked', () => {
        expect(buildLinkedAccounts([])).toBeUndefined()
    })
})

describe('buildSupportSegments', () => {
    const base = {
        isLoggedIn: true,
        platform: 'ios-native',
        identityStatus: 'verified',
        hasFailureReason: false,
        emailOnFile: true,
        hasCard: false,
        balanceKnown: true,
        isZeroBalance: false,
        isOffline: false,
        isApiUnreachable: false,
    }

    it('short-circuits to guest without leaking a logged-out user state', () => {
        expect(buildSupportSegments({ ...base, isLoggedIn: false })).toEqual(['ios-native', 'guest'])
    })

    it('prefers balance-unavailable over zero-balance', () => {
        const segments = buildSupportSegments({ ...base, balanceKnown: false, isZeroBalance: true })
        expect(segments).toContain('balance-unavailable')
        expect(segments).not.toContain('zero-balance')
    })

    it('flags a blocked verification', () => {
        expect(buildSupportSegments({ ...base, hasFailureReason: true })).toContain('verification-blocked')
    })
})

describe('relativeAge', () => {
    it('compacts to the largest useful unit', () => {
        expect(relativeAge('2026-08-27T11:59:30Z', NOW)).toBe('just now')
        expect(relativeAge('2026-08-27T11:30:00Z', NOW)).toBe('30m')
        expect(relativeAge('2026-08-27T09:00:00Z', NOW)).toBe('3h')
        expect(relativeAge('2026-08-20T12:00:00Z', NOW)).toBe('7d')
        expect(relativeAge(undefined, NOW)).toBeUndefined()
    })
})

describe('normalizeSupportRoute', () => {
    /*
     * The route answers "where were they when it broke", which is worth having.
     * The identifier inside it names who they were paying, which is the same
     * counterparty leak the activity row was built to avoid.
     */
    it('strips the person out of an identifier-bearing route', () => {
        expect(normalizeSupportRoute('/pay/bob')).toBe('/pay/:id')
        expect(normalizeSupportRoute('/send/bob')).toBe('/send/:id')
        expect(normalizeSupportRoute('/request/bob')).toBe('/request/:id')
        expect(normalizeSupportRoute('/receipt/abc-123')).toBe('/receipt/:id')
    })

    /*
     * The root `[...recipient]` catch-all makes any unlisted single segment a
     * possible handle, so the default is to redact. Forgetting to list a new
     * static route costs precision, never privacy.
     */
    it('redacts a bare segment that could be a username', () => {
        expect(normalizeSupportRoute('/glorfindel')).toBe('/:recipient')
        expect(normalizeSupportRoute('/some-route-nobody-listed')).toBe('/:recipient')
    })

    it('keeps routes whose segments name a thing, not a person', () => {
        expect(normalizeSupportRoute('/withdraw/manteca')).toBe('/withdraw/manteca')
        expect(normalizeSupportRoute('/limits/bridge')).toBe('/limits/bridge')
        expect(normalizeSupportRoute('/home')).toBe('/home')
    })

    it('sees through the locale prefix', () => {
        expect(normalizeSupportRoute('/es-419/pay/bob')).toBe('/pay/:id')
        expect(normalizeSupportRoute('/pt-br/help')).toBe('/help')
    })

    it('handles the root and the absent case', () => {
        expect(normalizeSupportRoute('/')).toBe('/')
        expect(normalizeSupportRoute(undefined)).toBeUndefined()
    })
})
