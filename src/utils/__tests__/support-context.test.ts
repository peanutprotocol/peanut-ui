import {
    buildAccountStats,
    buildBalanceSummary,
    buildCardSummary,
    buildLinkedAccounts,
    buildSupportLinks,
    buildSupportSegments,
    normalizeSupportRoute,
    redactSupportText,
    relativeAge,
} from '../support-context'
import { AccountType, type Account, type IUserProfile } from '@/interfaces/interfaces'
import type { RainCardOverview } from '@/services/rain'

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

describe('buildSupportLinks', () => {
    it('builds a card-member portal re-upload link from the Rain user id', () => {
        const links = buildSupportLinks('user-1', undefined, undefined, 'rain-abc')
        expect(links.cardPortalLink).toBe('https://cardmemberportal.com/kyc?userId=rain-abc')
    })

    it('leaves the portal link undefined when there is no Rain user id', () => {
        expect(buildSupportLinks('user-1', undefined, undefined, undefined).cardPortalLink).toBeUndefined()
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

    /*
     * Zero must be decided by the displayed total. During the smart-to-collateral
     * handoff the funds sit in neither bucket and only the in-transit figure
     * accounts for them, so reading the halves directly puts a `zero-balance`
     * flag next to a funded balance row.
     */
    it('does not call an in-transit balance zero', () => {
        expect(buildSupportSegments({ ...base, isZeroBalance: false })).not.toContain('zero-balance')
        expect(buildSupportSegments({ ...base, isZeroBalance: true })).toContain('zero-balance')
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

describe('redactSupportText', () => {
    /*
     * The fragment is a bearer credential: on a claim page it derives the
     * private claim key, so whoever holds it can take the funds. ClaimErrorView
     * hands support `window.location.href`, and the app publishes the topic to
     * Crisp on open — before the user has decided to send anything.
     */
    it('strips the claim password while keeping what identifies the link', () => {
        const redacted = redactSupportText(
            "I can't claim this: https://peanut.me/claim?c=42161&v=v4.3&i=17#p=Xy7SecretPw"
        )

        expect(redacted).not.toContain('Xy7SecretPw')
        expect(redacted).not.toContain('#')
        // the query locates the deposit on-chain — an agent still needs it
        expect(redacted).toContain('?c=42161&v=v4.3&i=17')
    })

    /*
     * The query is the other place a credential hides — `?code=` on an OAuth
     * callback, `?token=` on a magic link. Dropping it everywhere except the
     * paths known to identify rather than authorize means an unlisted page
     * loses context, never a secret.
     */
    it('drops the query on any path not known to need it', () => {
        expect(redactSupportText('https://peanut.me/auth/callback?code=oauth_secret')).toBe(
            'https://peanut.me/auth/callback'
        )
        expect(redactSupportText('https://peanut.me/login?token=magic_link_token')).toBe('https://peanut.me/login')
    })

    /*
     * Naming the path is not enough. Forwarding `url.search` wholesale carried
     * anything else that happened to be on a claim URL — a parameter added
     * later, or an encoded nested link — straight to Crisp once the fragment
     * was gone. The query is rebuilt from the vetted names instead.
     */
    it('rebuilds the claim query from vetted names, dropping anything else', () => {
        const redacted = redactSupportText(
            'https://peanut.me/claim?c=42161&v=v4.3&i=17&token=leaked&next=https%3A%2F%2Fevil.example%3Fp%3Dnested'
        )

        expect(redacted).toBe('https://peanut.me/claim?c=42161&v=v4.3&i=17')
        expect(redacted).not.toContain('leaked')
        expect(redacted).not.toContain('nested')
    })

    it('keeps only the claim params that are actually present', () => {
        expect(redactSupportText('https://peanut.me/claim?i=17')).toBe('https://peanut.me/claim?i=17')
        expect(redactSupportText('https://peanut.me/claim')).toBe('https://peanut.me/claim')
    })

    it('redacts every link in a message, not just the first', () => {
        const redacted = redactSupportText('tried https://peanut.me/claim#p=one then https://peanut.me/claim#p=two')

        expect(redacted).not.toContain('p=one')
        expect(redacted).not.toContain('p=two')
    })

    it('keeps the claim query behind a locale prefix too', () => {
        expect(redactSupportText('https://peanut.me/es-419/claim?i=17#p=secret')).toBe(
            'https://peanut.me/es-419/claim?i=17'
        )
    })

    it('leaves ordinary support messages alone', () => {
        expect(redactSupportText('my withdrawal is stuck')).toBe('my withdrawal is stuck')
        expect(redactSupportText('see https://peanut.me/help/withdrawals')).toBe(
            'see https://peanut.me/help/withdrawals'
        )
        expect(redactSupportText('')).toBe('')
    })
})
