import {
    DEPOSIT_LANDING_TTL_MS,
    forgetDepositLanding,
    readDepositLanding,
    rememberDepositLanding,
    rememberEarlyLanding,
} from '../depositLanding'

beforeEach(() => sessionStorage.clear())

describe('a held deposit kept across drawer openings', () => {
    it('is kept per user and address, case-insensitive on the address', () => {
        rememberDepositLanding('u1', '0xABC', 2.5, 1_000)
        expect(readDepositLanding('u1', '0xabc', 2_000)).toEqual({ from: 2.5, rose: null, at: 1_000 })
        expect(readDepositLanding('u2', '0xabc', 2_000)).toBeNull()
    })

    it('keeps the first baseline: a later opening never moves it up', () => {
        rememberDepositLanding('u1', '0xabc', 2.5, 1_000)
        rememberDepositLanding('u1', '0xabc', 6.5, 2_000)
        expect(readDepositLanding('u1', '0xabc', 3_000)?.from).toBe(2.5)
    })

    it('expires after an hour, and is gone once forgotten', () => {
        rememberDepositLanding('u1', '0xabc', 2.5, 0)
        expect(readDepositLanding('u1', '0xabc', DEPOSIT_LANDING_TTL_MS - 1)).not.toBeNull()
        expect(readDepositLanding('u1', '0xabc', DEPOSIT_LANDING_TTL_MS)).toBeNull()
        rememberDepositLanding('u1', '0xdef', 1, 0)
        forgetDepositLanding('u1', '0xdef')
        expect(readDepositLanding('u1', '0xdef', 1)).toBeNull()
    })

    it('replaces the hold with what rose early, until it is forgotten', () => {
        rememberDepositLanding('u1', '0xabc', 2.5, 1_000)
        rememberEarlyLanding('u1', '0xabc', { from: 6.5, rose: 4 }, 2_000)
        expect(readDepositLanding('u1', '0xabc', 3_000)).toEqual({ from: 6.5, rose: 4, at: 2_000 })
    })

    it('keeps nothing without a user', () => {
        rememberDepositLanding(undefined, '0xabc', 1)
        expect(readDepositLanding(undefined, '0xabc')).toBeNull()
        expect(sessionStorage.length).toBe(0)
    })
})
