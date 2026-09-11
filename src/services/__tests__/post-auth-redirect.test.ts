import { consumePostAuthRedirect } from '../post-auth-redirect'
import {
    clearRedirectUrl,
    getRedirectOrigin,
    getRedirectUrl,
    getStoredRedirect,
    saveToLocalStorage,
    setRedirectUrl,
} from '@/utils/general.utils'

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
    const originalRemoveItem = Storage.prototype.removeItem
    const originalSetItem = Storage.prototype.setItem
    const originalKey = Storage.prototype.key

    afterEach(() => {
        Storage.prototype.getItem = originalGetItem
        Storage.prototype.removeItem = originalRemoveItem
        Storage.prototype.setItem = originalSetItem
        Storage.prototype.key = originalKey
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

    it('does not clear a newer record after consuming an older snapshot', () => {
        const stale = JSON.stringify({ destination: '/profile', origin: 'session-end' })
        const fresher = JSON.stringify({ destination: '/receipt?id=abc', origin: 'deep-link' })
        localStorage.setItem('redirect', stale)
        let replaced = false
        Storage.prototype.getItem = function patched(key: string) {
            const value = originalGetItem.call(this, key)
            if (key === 'redirect' && !replaced) {
                replaced = true
                localStorage.setItem('redirect', fresher)
            }
            return value
        }

        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
        expect(getRedirectUrl()).toBe('/receipt?id=abc')
    })

    it('does not clear a newer record after observing no usable snapshot', () => {
        const fresher = JSON.stringify({ destination: '/receipt?id=abc', origin: 'deep-link' })
        let replaced = false
        Storage.prototype.getItem = function patched(key: string) {
            const value = originalGetItem.call(this, key)
            if (key === 'redirect' && !replaced) {
                replaced = true
                localStorage.setItem('redirect', fresher)
            }
            return value
        }

        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
        expect(getRedirectUrl()).toBe('/receipt?id=abc')
    })

    it('does not publish a legacy mirror when the authoritative v2 write fails', () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
        setItem.mockImplementation(function patched(this: Storage, key: string, value: string) {
            if (key === 'redirect-v2') throw new Error('quota')
            return originalSetItem.call(this, key, value)
        })

        setRedirectUrl('/receipt?id=abc', 'deep-link')

        expect(localStorage.getItem('redirect-v2')).toBeNull()
        expect(localStorage.getItem('redirect')).toBeNull()
        expect(getRedirectUrl()).toBeNull()
    })

    it('keeps the authoritative v2 payload ahead when its legacy mirror write fails', () => {
        setRedirectUrl('/profile', 'session-end')
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
        setItem.mockImplementation(function patched(this: Storage, key: string, value: string) {
            if (key === 'redirect') throw new Error('quota')
            return originalSetItem.call(this, key, value)
        })

        setRedirectUrl('/receipt?id=abc', 'deep-link')

        expect(getRedirectUrl()).toBe('/receipt?id=abc')
        expect(getRedirectOrigin()).toBe('deep-link')
    })

    it('re-reads the v2 pointer when a newer v2 generation arrives during the legacy read', () => {
        setRedirectUrl('/profile', 'session-end')
        const getItem = jest.spyOn(Storage.prototype, 'getItem')
        let replaced = false
        getItem.mockImplementation(function patched(this: Storage, key: string) {
            if (key === 'redirect-expiry' && !replaced) {
                replaced = true
                setRedirectUrl('/card', 'session-end')
            }
            return originalGetItem.call(this, key)
        })

        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('keeps revalidating when two newer v2 generations arrive during one read', () => {
        setRedirectUrl('/profile', 'session-end')
        const getItem = jest.spyOn(Storage.prototype, 'getItem')
        let publications = 0
        getItem.mockImplementation(function patched(this: Storage, key: string) {
            if (key === 'redirect-expiry' && publications === 0) {
                publications += 1
                setRedirectUrl('/card', 'session-end')
            } else if (key === 'redirect-v2' && publications === 1) {
                publications += 1
                setRedirectUrl('/receipt?id=abc', 'session-end')
            }
            return originalGetItem.call(this, key)
        })

        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('does not re-consume a redirect when the primary consumption marker write fails', () => {
        setRedirectUrl('/receipt?id=abc', 'deep-link')
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
        setItem.mockImplementation(function patched(this: Storage, key: string, value: string) {
            if (key.startsWith('redirect-v2-consumed:')) throw new Error('quota')
            return originalSetItem.call(this, key, value)
        })

        expect(consumePostAuthRedirect(null)).toEqual({
            destination: '/receipt?id=abc',
            source: 'stored',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('keeps a completed newer generation consumed when an older tab resumes', () => {
        setRedirectUrl('/profile', 'session-end')
        const olderSnapshot = getStoredRedirect()

        setRedirectUrl('/card', 'deep-link')
        expect(consumePostAuthRedirect(null)).toEqual({
            destination: '/card',
            source: 'stored',
            deferred: false,
        })

        clearRedirectUrl(olderSnapshot)
        expect(getRedirectUrl()).toBeNull()
    })

    it('reclaims reserved slots when a later redirect overwrites an unconsumed one', () => {
        setRedirectUrl('/profile', 'session-end')
        setRedirectUrl('/card', 'deep-link')

        const generationSlots = Array.from({ length: localStorage.length }, (_, index) =>
            localStorage.key(index)
        ).filter(
            (key): key is string =>
                typeof key === 'string' &&
                (key.startsWith('redirect-v2-consumed:') || key.startsWith('redirect-v2-consumed-fallback:'))
        )
        expect(generationSlots).toHaveLength(2)
    })

    it('reclaims reservations left by a failed v2 publication', () => {
        setRedirectUrl('/profile', 'session-end')
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
        setItem.mockImplementation(function patched(this: Storage, key: string, value: string) {
            if (key === 'redirect-v2') throw new Error('quota')
            return originalSetItem.call(this, key, value)
        })

        setRedirectUrl('/card', 'deep-link')

        const generationSlots = Array.from({ length: localStorage.length }, (_, index) =>
            localStorage.key(index)
        ).filter(
            (key): key is string =>
                typeof key === 'string' &&
                (key.startsWith('redirect-v2-consumed:') || key.startsWith('redirect-v2-consumed-fallback:'))
        )
        expect(generationSlots).toHaveLength(2)
        expect(getRedirectUrl()).toBe('/profile')
    })

    it('protects fresh in-flight reservation slots from cleanup', () => {
        setRedirectUrl('/profile', 'session-end')
        const inFlightGenerationId = 'in-flight-generation'
        const reservationValue = `r${Date.now().toString(36).padStart(10, '0')}`
        localStorage.setItem(`redirect-v2-consumed:${inFlightGenerationId}`, reservationValue)
        localStorage.setItem(`redirect-v2-consumed-fallback:${inFlightGenerationId}`, reservationValue)

        setRedirectUrl('/card', 'deep-link')

        expect(localStorage.getItem(`redirect-v2-consumed:${inFlightGenerationId}`)).toBe(reservationValue)
        expect(localStorage.getItem(`redirect-v2-consumed-fallback:${inFlightGenerationId}`)).toBe(reservationValue)
    })

    it('does not republish a generation after another tab consumes it', () => {
        setRedirectUrl('/profile', 'session-end')
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
        let interleaved = false
        setItem.mockImplementation(function patched(this: Storage, key: string, value: string) {
            const result = originalSetItem.call(this, key, value)
            if (key === 'redirect-v2' && !interleaved) {
                interleaved = true
                expect(consumePostAuthRedirect(null)).toEqual({
                    destination: '/card',
                    source: 'stored',
                    deferred: false,
                })
            }
            return result
        })

        setRedirectUrl('/card', 'deep-link')

        expect(getRedirectUrl()).toBeNull()
        const consumedSlots = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
            (key): key is string =>
                typeof key === 'string' &&
                (key.startsWith('redirect-v2-consumed:') || key.startsWith('redirect-v2-consumed-fallback:'))
        )
        expect(consumedSlots.some((key) => localStorage.getItem(key) === JSON.stringify('1'))).toBe(true)
    })

    it('does not let a stale publisher overwrite a newer legacy mirror', () => {
        setRedirectUrl('/profile', 'session-end')
        let interleaved = false
        Storage.prototype.getItem = function patched(key: string) {
            const value = originalGetItem.call(this, key)
            if (key === 'redirect-v2' && !interleaved && value !== null) {
                interleaved = true
                setRedirectUrl('/card', 'deep-link')
            }
            return value
        }

        setRedirectUrl('/profile', 'session-end')

        expect(getRedirectUrl()).toBe('/card')
        expect(getRedirectOrigin()).toBe('deep-link')
    })

    it('aborts tombstone cleanup when the authoritative pointer changes during the scan', () => {
        setRedirectUrl('/profile', 'session-end')
        const getKey = jest.spyOn(Storage.prototype, 'key')
        let interleaved = false
        getKey.mockImplementation(function patched(this: Storage, index: number) {
            if (!interleaved) {
                interleaved = true
                setRedirectUrl('/card', 'deep-link')
                expect(consumePostAuthRedirect(null)).toEqual({
                    destination: '/card',
                    source: 'stored',
                    deferred: false,
                })
            }
            return originalKey.call(this, index)
        })

        clearRedirectUrl()
        expect(getRedirectUrl()).toBeNull()
    })

    it('retires the v2 generation superseded by a consumed legacy handoff', () => {
        setRedirectUrl('/profile', 'session-end')
        saveToLocalStorage('redirect', '/receipt?id=abc')

        expect(consumePostAuthRedirect(null)).toEqual({
            destination: '/receipt?id=abc',
            source: 'stored',
            deferred: false,
        })
        expect(getRedirectUrl()).toBeNull()
    })

    it('reclaims consumed generation slots after later redirect publications', () => {
        for (let index = 0; index < 8; index += 1) {
            setRedirectUrl(`/receipt?id=${index}`, 'deep-link')
            expect(consumePostAuthRedirect(null)).toEqual({
                destination: `/receipt?id=${index}`,
                source: 'stored',
                deferred: false,
            })
        }

        const generationSlots = Array.from({ length: localStorage.length }, (_, index) =>
            localStorage.key(index)
        ).filter(
            (key): key is string =>
                typeof key === 'string' &&
                (key.startsWith('redirect-v2-consumed:') || key.startsWith('redirect-v2-consumed-fallback:'))
        )
        expect(generationSlots).toHaveLength(2)
    })

    it('does not consume a newer generation when it arrives before the consumption marker', () => {
        setRedirectUrl('/profile', 'session-end')
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
        let replaced = false
        setItem.mockImplementation(function patched(this: Storage, key: string, value: string) {
            if (!replaced && key.startsWith('redirect-v2-consumed:')) {
                replaced = true
                setRedirectUrl('/receipt?id=abc', 'deep-link')
            }
            return originalSetItem.call(this, key, value)
        })

        expect(consumePostAuthRedirect(null, { rejectSessionEndOrigin: true })).toEqual({
            destination: '/home',
            source: 'fallback',
            deferred: false,
        })
        expect(getRedirectUrl()).toBe('/receipt?id=abc')
    })

    it('keeps v2 state when a pre-deploy tab clears the legacy handoff', () => {
        setRedirectUrl('/pay-request/abc', 'deep-link')

        // The base bundle only knows about v1's destination key.
        localStorage.removeItem('redirect')

        expect(getRedirectUrl()).toBe('/pay-request/abc')
        expect(getRedirectOrigin()).toBe('deep-link')
    })

    it('honours a newer legacy handoff written by a pre-deploy tab', () => {
        setRedirectUrl('/profile', 'session-end')
        saveToLocalStorage('redirect', '/receipt?id=abc')

        expect(getRedirectUrl()).toBe('/receipt?id=abc')
        expect(getRedirectOrigin()).toBeNull()
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
