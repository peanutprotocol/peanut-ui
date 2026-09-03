/**
 * pickMantecaDepositAddress decides WHERE user USDC is irreversibly sent
 * (qr-pay, bank withdraw, claim-link offramp), so every branch is pinned:
 * the API-served entity address wins when valid, and anything else — empty
 * string, malformed value, absent field — falls back to the local constant
 * (with a Sentry report when a served value existed but failed validation).
 */
import { pickMantecaDepositAddress, requireMantecaDepositAddress, resolveOfframpSpendRecipient } from '../manteca.utils'

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

    test('the zero address is syntactically valid but never a recipient — falls back AND reports', () => {
        expect(pickMantecaDepositAddress('0x0000000000000000000000000000000000000000', FALLBACK)).toBe(FALLBACK)
        expect(mockCapture).toHaveBeenCalledTimes(1)
    })

    test('a malformed served value falls back AND reports to Sentry', () => {
        expect(pickMantecaDepositAddress('not-an-address', FALLBACK)).toBe(FALLBACK)
        expect(pickMantecaDepositAddress('0x1234', FALLBACK)).toBe(FALLBACK)
        expect(pickMantecaDepositAddress(42 as unknown, FALLBACK)).toBe(FALLBACK)
        expect(mockCapture).toHaveBeenCalledTimes(3)
    })
})

describe('requireMantecaDepositAddress (fail-closed paths)', () => {
    test('a valid address passes', () => {
        expect(requireMantecaDepositAddress(SERVED)).toBe(SERVED)
        expect(mockCapture).not.toHaveBeenCalled()
    })

    test('missing, empty, malformed, and zero all return null AND report — never a fallback', () => {
        for (const bad of [undefined, null, '', '0x1234', '0x0000000000000000000000000000000000000000']) {
            expect(requireMantecaDepositAddress(bad)).toBeNull()
        }
        expect(mockCapture).toHaveBeenCalledTimes(5)
    })
})

describe('resolveOfframpSpendRecipient (bank-withdraw priceLock → signSpend handoff)', () => {
    test("the price lock's API-served entity address is the exact spend recipient", () => {
        expect(resolveOfframpSpendRecipient({ depositAddress: SERVED })).toBe(SERVED)
    })

    test('an older API without the field falls back to the legacy constant', () => {
        expect(resolveOfframpSpendRecipient({})).toBe('0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053')
        expect(resolveOfframpSpendRecipient(null)).toBe('0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053')
    })

    test('a malformed served value never becomes the recipient', () => {
        expect(resolveOfframpSpendRecipient({ depositAddress: '0x1234' })).toBe(
            '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053'
        )
    })
})
