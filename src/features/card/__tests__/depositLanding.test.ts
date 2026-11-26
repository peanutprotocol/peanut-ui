import {
    DEPOSIT_LANDING_TTL_MS,
    forgetDepositLanding,
    readDepositLanding,
    rememberDepositLanding,
} from '../depositLanding'

beforeEach(() => sessionStorage.clear())

describe('a held deposit kept across drawer openings', () => {
    it('is kept per user and address, case-insensitive on the address', () => {
        rememberDepositLanding('u1', '0xABC', { from: 2.5, amount: 4 }, 1_000)
        expect(readDepositLanding('u1', '0xabc', 2_000)).toEqual({ from: 2.5, amount: 4, at: 1_000 })
        expect(readDepositLanding('u2', '0xabc', 2_000)).toBeNull()
    })

    it('keeps the first baseline: a later opening never moves it up', () => {
        rememberDepositLanding('u1', '0xabc', { from: 2.5, amount: null }, 1_000)
        rememberDepositLanding('u1', '0xabc', { from: 6.5, amount: null }, 2_000)
        expect(readDepositLanding('u1', '0xabc', 3_000)?.from).toBe(2.5)
    })

    it('expires after an hour, and is gone once forgotten', () => {
        rememberDepositLanding('u1', '0xabc', { from: 2.5, amount: null }, 0)
        expect(readDepositLanding('u1', '0xabc', DEPOSIT_LANDING_TTL_MS - 1)).not.toBeNull()
        expect(readDepositLanding('u1', '0xabc', DEPOSIT_LANDING_TTL_MS)).toBeNull()
        rememberDepositLanding('u1', '0xdef', { from: 1, amount: null }, 0)
        forgetDepositLanding('u1', '0xdef')
        expect(readDepositLanding('u1', '0xdef', 1)).toBeNull()
    })

    it('keeps nothing without a user', () => {
        rememberDepositLanding(undefined, '0xabc', { from: 1, amount: null })
        expect(readDepositLanding(undefined, '0xabc')).toBeNull()
        expect(sessionStorage.length).toBe(0)
    })
})
