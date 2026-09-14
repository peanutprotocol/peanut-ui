/** @jest-environment jsdom */
// invite-stash — the ONE lifecycle for the invite code + type cookies (Chip
// review, PR #2949). The type feeds POST /invites/accept and is persisted on
// the Invites row, so a code written without its type would let a stale type
// from an earlier flow misclassify the invite. These run the REAL cookie
// round trip — every other spec mocks this module.
import { EInviteType } from '@/services/services.types'
import { stashInvite, readInviteCode, readInviteType, extendInviteForRetry, clearInvite } from '@/utils/invite-stash'
import { getFromCookie } from '@/utils/general.utils'

const wipeCookies = () => {
    for (const name of ['inviteCode', 'inviteType']) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    }
}

beforeEach(wipeCookies)
afterAll(wipeCookies)

describe('invite-stash', () => {
    it('round-trips code and type through the cookie helpers', () => {
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        expect(readInviteCode()).toBe('alice')
        expect(readInviteType()).toBe(EInviteType.PAYMENT_LINK)
    })

    it('falls back to DIRECT for a missing or unrecognised type cookie', () => {
        expect(readInviteType()).toBe(EInviteType.DIRECT)
        document.cookie = 'inviteType=NOT_A_REAL_TYPE'
        expect(readInviteType()).toBe(EInviteType.DIRECT)
    })

    it('a later stash overwrites BOTH fields — a bare-code writer resets the type', () => {
        // the drift chip flagged: visit a payment link (PAYMENT_LINK), then
        // arrive through a deferred/deep link that only knows a code — the
        // old code-only cookie write kept PAYMENT_LINK for an unrelated code
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        stashInvite('bob', EInviteType.DIRECT)
        expect(readInviteCode()).toBe('bob')
        expect(readInviteType()).toBe(EInviteType.DIRECT)
    })

    it('extendInviteForRetry keeps code AND type together', () => {
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        extendInviteForRetry(30)
        expect(readInviteCode()).toBe('alice')
        expect(readInviteType()).toBe(EInviteType.PAYMENT_LINK)
    })

    it('extendInviteForRetry with no stashed code writes nothing', () => {
        extendInviteForRetry(30)
        expect(readInviteCode()).toBe('')
        expect(getFromCookie('inviteType')).toBeFalsy()
    })

    it('clearInvite blanks both fields', () => {
        stashInvite('alice', EInviteType.PAYMENT_LINK)
        clearInvite()
        expect(readInviteCode()).toBe('')
        expect(readInviteType()).toBe(EInviteType.DIRECT)
    })
})
