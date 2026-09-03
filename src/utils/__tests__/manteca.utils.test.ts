/**
 * pickMantecaDepositAddress decides WHERE user USDC is irreversibly sent
 * (qr-pay, bank withdraw, claim-link offramp), so every branch is pinned:
 * the API-served entity address wins when valid, and anything else — empty
 * string, malformed value, absent field — falls back to the local constant
 * (with a Sentry report when a served value existed but failed validation).
 */
import { pickMantecaDepositAddress } from '../manteca.utils'

const mockCapture = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureMessage: (...args: unknown[]) => mockCapture(...args),
}))

const FALLBACK = '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053' as const
const SERVED = '0x6E945f8EC93061f5f11Edc5e6Fb4A70BeB514e97'

beforeEach(() => mockCapture.mockClear())

describe('pickMantecaDepositAddress', () => {
    test('a valid API-served address wins over the constant', () => {
        expect(pickMantecaDepositAddress(SERVED, FALLBACK)).toBe(SERVED)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    test('an absent field falls back silently (older API during rollout)', () => {
        expect(pickMantecaDepositAddress(undefined, FALLBACK)).toBe(FALLBACK)
        expect(pickMantecaDepositAddress(null, FALLBACK)).toBe(FALLBACK)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    test('an empty string does NOT slip past the fallback (?? would let it through)', () => {
        expect(pickMantecaDepositAddress('', FALLBACK)).toBe(FALLBACK)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    test('a malformed served value falls back AND reports to Sentry', () => {
        expect(pickMantecaDepositAddress('not-an-address', FALLBACK)).toBe(FALLBACK)
        expect(pickMantecaDepositAddress('0x1234', FALLBACK)).toBe(FALLBACK)
        expect(pickMantecaDepositAddress(42 as unknown, FALLBACK)).toBe(FALLBACK)
        expect(mockCapture).toHaveBeenCalledTimes(3)
    })
})
