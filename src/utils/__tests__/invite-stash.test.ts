/** @jest-environment jsdom */
// invite-stash — the ONE lifecycle for the invite code + type + owner (Chip
// review, PR #2949). The type feeds POST /invites/accept and is persisted on
// the Invites row, so a code written without its type would let a stale type
// from an earlier flow misclassify the invite. These run the REAL storage
// round trip — every other spec mocks this module.
//
// Every case also runs in a document whose cookies never stick, the way iOS
// WKWebView loses the session cookie this stash used to be: that loss dropped
// every iOS referral between first launch and registration (Oct 2026).
import { EInviteType } from '@/services/services.types'
import {
    bindInviteToUser,
    clearInvite,
    clearInviteIfOwnedBy,
    extendInviteForRetry,
    INVITE_STASH_STORAGE_KEY,
    INVITE_STASH_TTL_MS,
    readInviteCode,
    readInviteType,
    readInviteUserId,
    stashInvite,
} from '@/utils/invite-stash'

const DAY_MS = 24 * 60 * 60 * 1000

function dropAllCookies() {
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: () => {} })
}

function restoreCookies() {
    // the own property shadows Document.prototype's real accessor
    delete (document as unknown as Record<string, unknown>).cookie
}

describe.each([
    ['a browser with working cookies', () => {}],
    ['an iOS WebView that loses every cookie', dropAllCookies],
])('invite-stash in %s', (_environment, setUpDocument) => {
    beforeEach(() => {
        localStorage.clear()
        setUpDocument()
    })
    afterEach(() => {
        restoreCookies()
        jest.useRealTimers()
    })

    it('round-trips code and type', () => {
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        expect(readInviteCode()).toBe('alice')
        expect(readInviteType()).toBe(EInviteType.PAYMENT_LINK)
    })

    it('reads an empty stash as no code and a DIRECT type', () => {
        expect(readInviteCode()).toBe('')
        expect(readInviteType()).toBe(EInviteType.DIRECT)
        expect(readInviteUserId()).toBe('')
    })

    it('falls back to DIRECT for an unrecognised stored type', () => {
        localStorage.setItem(
            INVITE_STASH_STORAGE_KEY,
            JSON.stringify({ code: 'alice', type: 'NOT_A_REAL_TYPE', userId: '', expiresAt: Date.now() + DAY_MS })
        )
        expect(readInviteCode()).toBe('alice')
        expect(readInviteType()).toBe(EInviteType.DIRECT)
    })

    it('treats a corrupt record as no invite and removes it', () => {
        localStorage.setItem(INVITE_STASH_STORAGE_KEY, '{not json')
        expect(readInviteCode()).toBe('')
        expect(localStorage.getItem(INVITE_STASH_STORAGE_KEY)).toBeNull()
    })

    it('a later stash overwrites ALL fields — a bare-code writer resets the type and owner', () => {
        // the drift chip flagged: visit a payment link (PAYMENT_LINK), then
        // arrive through a deferred/deep link that only knows a code
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        bindInviteToUser('user-a')
        stashInvite('bob', EInviteType.DIRECT)
        expect(readInviteCode()).toBe('bob')
        expect(readInviteType()).toBe(EInviteType.DIRECT)
        expect(readInviteUserId()).toBe('')
    })

    it('stashing an empty code clears the stash', () => {
        stashInvite('alice', EInviteType.DIRECT)
        stashInvite('', EInviteType.DIRECT)
        expect(readInviteCode()).toBe('')
    })

    it('survives until registration a day later, then expires', () => {
        jest.useFakeTimers({ now: new Date('2026-10-15T10:00:00Z') })
        stashInvite('alice', EInviteType.DIRECT)

        jest.setSystemTime(Date.now() + INVITE_STASH_TTL_MS - 1)
        expect(readInviteCode()).toBe('alice')

        jest.setSystemTime(Date.now() + 1)
        expect(readInviteCode()).toBe('')
        expect(localStorage.getItem(INVITE_STASH_STORAGE_KEY)).toBeNull()
    })

    it('binds a pending invite to only the first authenticated account', () => {
        stashInvite('alice', EInviteType.DIRECT)
        expect(bindInviteToUser('user-a')).toBe(true)
        expect(readInviteUserId()).toBe('user-a')
        expect(bindInviteToUser('user-b')).toBe(false)
        expect(readInviteUserId()).toBe('user-a')
    })

    it('binds nothing when no invite is stashed', () => {
        expect(bindInviteToUser('user-a')).toBe(false)
        expect(readInviteUserId()).toBe('')
    })

    it('extendInviteForRetry keeps code, type and owner together for 30 days', () => {
        jest.useFakeTimers({ now: new Date('2026-10-15T10:00:00Z') })
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        bindInviteToUser('user-a')
        extendInviteForRetry(30, { inviteCode: 'alice', userId: 'user-a' })

        jest.setSystemTime(Date.now() + 29 * DAY_MS)
        expect(readInviteCode()).toBe('alice')
        expect(readInviteType()).toBe(EInviteType.PAYMENT_LINK)
        expect(readInviteUserId()).toBe('user-a')

        jest.setSystemTime(Date.now() + 2 * DAY_MS)
        expect(readInviteCode()).toBe('')
    })

    it('extendInviteForRetry with no stashed code writes nothing', () => {
        extendInviteForRetry(30)
        expect(readInviteCode()).toBe('')
        expect(localStorage.getItem(INVITE_STASH_STORAGE_KEY)).toBeNull()
    })

    it('extendInviteForRetry does not extend a hand-off another account now owns', () => {
        jest.useFakeTimers({ now: new Date('2026-10-15T10:00:00Z') })
        stashInvite('bob', EInviteType.DIRECT)
        bindInviteToUser('user-b')
        extendInviteForRetry(30, { inviteCode: 'alice', userId: 'user-a' })

        jest.setSystemTime(Date.now() + INVITE_STASH_TTL_MS)
        expect(readInviteCode()).toBe('')
    })

    it('clearInvite blanks every field', () => {
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        bindInviteToUser('user-a')
        clearInvite()
        expect(readInviteCode()).toBe('')
        expect(readInviteType()).toBe(EInviteType.DIRECT)
        expect(readInviteUserId()).toBe('')
    })

    it('an older request cannot clear a newer account hand-off', () => {
        stashInvite('alice', EInviteType.DIRECT)
        bindInviteToUser('user-a')
        stashInvite('bob', EInviteType.DIRECT)
        bindInviteToUser('user-b')

        expect(clearInviteIfOwnedBy('alice', 'user-a')).toBe(false)
        expect(readInviteCode()).toBe('bob')
        expect(readInviteUserId()).toBe('user-b')
        expect(clearInviteIfOwnedBy('bob', 'user-b')).toBe(true)
        expect(readInviteCode()).toBe('')
    })
})

describe('invite-stash with no usable storage', () => {
    afterEach(() => jest.restoreAllMocks())

    it('degrades to no invite instead of throwing into signup', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError')
        })
        expect(() => stashInvite('alice', EInviteType.DIRECT)).not.toThrow()
        expect(readInviteCode()).toBe('')
        expect(bindInviteToUser('user-a')).toBe(false)
    })
})
