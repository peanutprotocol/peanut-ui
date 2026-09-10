import { consumePostAuthRedirect } from '../post-auth-redirect'
import { getRedirectUrl, saveToLocalStorage, setRedirectUrl } from '@/utils/general.utils'

const FINANCIAL_REDIRECT = '/claim?step=claim&id=payment-1'
const CAMPAIGN_REDIRECT = '/add-money/crypto?network=EVM'

describe('post-auth redirect consumption', () => {
    beforeEach(() => localStorage.clear())

    it('discards a lower-priority campaign destination when an explicit financial continuation wins', () => {
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)

        expect(consumePostAuthRedirect(FINANCIAL_REDIRECT)).toEqual({
            destination: FINANCIAL_REDIRECT,
            source: 'explicit',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()

        // A later login cannot resurrect the superseded campaign journey.
        expect(consumePostAuthRedirect(null)).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
    })

    it('also consumes stored state when a malformed explicit redirect falls back safely', () => {
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)

        expect(consumePostAuthRedirect('https://attacker.example/claim')).toEqual({
            destination: '/home',
            source: 'explicit',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('consumes a confirmed published campaign destination exactly once', () => {
        saveToLocalStorage('redirect', CAMPAIGN_REDIRECT)

        expect(consumePostAuthRedirect(null)).toEqual({
            destination: CAMPAIGN_REDIRECT,
            source: 'stored',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('can deliberately retain a safe stored continuation for a post-signup action', () => {
        saveToLocalStorage('redirect', FINANCIAL_REDIRECT)

        expect(
            consumePostAuthRedirect(null, {
                deferStoredRedirect: (destination) => destination.includes('/claim'),
            })
        ).toEqual({ destination: '/home', source: 'stored', deferred: true })
        expect(getRedirectUrl()).toBe(FINANCIAL_REDIRECT)
    })

    /*
     * Order matters where the two rules overlap: a claim or request route that
     * a PREVIOUS session was standing on is still that session's, so it is
     * refused and consumed rather than held for the new account to continue.
     * Deferral exists to carry a continuation forward for the same person.
     */
    it('refuses a session-end money route for a new account instead of deferring it', () => {
        setRedirectUrl(FINANCIAL_REDIRECT, 'session-end')

        expect(
            consumePostAuthRedirect(null, {
                rejectSessionEndOrigin: true,
                deferStoredRedirect: (destination) => destination.includes('/claim'),
            })
        ).toEqual({ destination: '/home', source: 'fallback', deferred: false })
        expect(getRedirectUrl()).toBeNull()
    })

    it('never defers an unsafe stored URL merely because its text matches the predicate', () => {
        saveToLocalStorage('redirect', 'https://attacker.example/claim')

        expect(
            consumePostAuthRedirect(null, {
                deferStoredRedirect: (destination) => destination.includes('/claim'),
            })
        ).toEqual({ destination: '/home', source: 'stored', deferred: false })
        expect(getRedirectUrl()).toBeNull()
    })
})

/*
 * Two tabs, one localStorage — the shape of Chip's round-1 repro. The logout
 * latch is module memory, so only the tab the person logged out in has it
 * armed: tab B's revoked session refetches to null and its gate stores tab B's
 * own page, because nothing in that document knows a logout happened. A logout
 * broadcast would have to reach it in time; the provenance on the record does
 * not have to reach anywhere, which is why the new account is safe either way.
 * The same holds when tab B's session simply expires and no logout ever runs.
 */
/*
 * Records written before the origin existed are a bare path — the deployed
 * version stored no provenance. They are honoured, deliberately: discarding
 * them would drop the stored pay-link continuation for anyone mid-funnel
 * across the deploy (a signup entered from /receipt landing on /home), which
 * is a worse transitional harm than the reverse case of a new account on the
 * previous session's page — and that case no longer errors on Back. Every
 * writer classifies from the first write after deploy, so the window closes
 * on its own.
 */
describe('post-auth redirect for a record from before the origin existed', () => {
    beforeEach(() => localStorage.clear())

    const storeLegacyRecord = (destination: string) => saveToLocalStorage('redirect', destination)

    it('reaches a brand-new account, so a pay-link signup still completes', () => {
        storeLegacyRecord('/receipt?id=abc')

        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/receipt?id=abc',
            source: 'stored',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('an existing account logging in resumes it too', () => {
        storeLegacyRecord(CAMPAIGN_REDIRECT)

        expect(consumePostAuthRedirect(null)).toEqual({
            destination: CAMPAIGN_REDIRECT,
            source: 'stored',
            deferred: false,
        })
    })

    it('but a classified session-end record is still refused for a new account', () => {
        // what the gate writes once this ships, which is the case that matters
        setRedirectUrl('/profile', 'session-end')

        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('and an explicit redirect_uri outranks a stored record either way', () => {
        storeLegacyRecord('/profile')

        expect(consumePostAuthRedirect(FINANCIAL_REDIRECT, { rejectSessionEndOrigin: true })).toEqual({
            destination: FINANCIAL_REDIRECT,
            source: 'explicit',
            deferred: false,
        })
    })
})

/*
 * The pair has to come from one snapshot. Reading the destination and the
 * origin separately is two getItems, and another tab can replace the record
 * in between — which would pair an old destination with the newer record's
 * origin, and then consume the newer intent along with it.
 */
describe('post-auth redirect reads one snapshot', () => {
    const originalGetItem = Storage.prototype.getItem

    afterEach(() => {
        Storage.prototype.getItem = originalGetItem
        localStorage.clear()
    })

    it('decides from the record it first observed, not a pair from two reads', () => {
        localStorage.clear()
        const stale = JSON.stringify({ destination: '/profile', origin: 'session-end' })
        const fresher = JSON.stringify({ destination: '/receipt?id=abc', origin: 'deep-link' })
        let reads = 0
        Storage.prototype.getItem = function patched(key: string) {
            if (key !== 'redirect') return originalGetItem.call(this, key)
            reads += 1
            // another tab replaces the record after the first read
            return reads === 1 ? stale : fresher
        }

        // the stale record is session-end, so a new account must refuse it —
        // never accept /profile while reading the newer record's deep-link
        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
    })
})

describe('post-auth redirect across two tabs', () => {
    type UtilsModule = typeof import('@/utils/general.utils')

    // a separate module registry per tab: distinct module memory (the latch),
    // one shared localStorage — exactly what two same-origin documents get
    const openTab = (): UtilsModule => {
        let tab!: UtilsModule
        jest.isolateModules(() => {
            tab = require('@/utils/general.utils')
        })
        return tab
    }

    beforeEach(() => localStorage.clear())

    it("a second tab's collapsing session cannot hand its page to the new account", () => {
        const tabA = openTab()
        const tabB = openTab()

        // tab A: the person logs out here, so this tab's latch is armed and it
        // leaves nothing behind
        window.history.replaceState({}, '', '/profile')
        tabA.beginIntentionalLogout()
        tabA.saveRedirectUrl('session-end')
        expect(tabA.getRedirectUrl()).toBeNull()

        // tab B: same origin, different document, latch never armed — it
        // stores its own protected page as tab A's logout revokes the session
        window.history.replaceState({}, '', '/card')
        tabB.saveRedirectUrl('session-end')
        expect(tabB.getRedirectUrl()).toBe('/card')

        // the account created back in tab A inherits none of it
        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
        // consumed, so a later account cannot pick it up either
        expect(tabA.getRedirectUrl()).toBeNull()
    })

    it('a deep link opened in that second tab still reaches the new account', () => {
        const tabB = openTab()

        // this document never held a session: the destination is the visitor's
        // own intent, not the residue of someone's session
        window.history.replaceState({}, '', '/pay-request/abc')
        tabB.saveRedirectUrl()

        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/pay-request/abc',
            source: 'stored',
            deferred: false,
        })
    })
})
