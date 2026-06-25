import { isWithdrawFeeDisproportionate, MAX_WITHDRAW_FEE_RATIO } from './cross-chain-fee.utils'

describe('isWithdrawFeeDisproportionate', () => {
    test('allows a tiny L2 fee on a normal amount', () => {
        // $0.08 fee on $10 → 0.8%
        expect(isWithdrawFeeDisproportionate(0.08, 10)).toBe(false)
    })

    test('blocks a small mainnet withdraw where flat gas dominates', () => {
        // $1.50 fee on $10 → 15%
        expect(isWithdrawFeeDisproportionate(1.5, 10)).toBe(true)
    })

    test('allows the same mainnet fee on a larger amount', () => {
        // $1.50 fee on $100 → 1.5%
        expect(isWithdrawFeeDisproportionate(1.5, 100)).toBe(false)
    })

    test('is strict at the threshold boundary', () => {
        // exactly 5% is allowed; just over is blocked
        expect(isWithdrawFeeDisproportionate(0.5, 10)).toBe(false) // 5.0%
        expect(isWithdrawFeeDisproportionate(0.51, 10)).toBe(true) // 5.1%
    })

    test('no fee / zero fee is never disproportionate (same-chain, sponsored)', () => {
        expect(isWithdrawFeeDisproportionate(undefined, 10)).toBe(false)
        expect(isWithdrawFeeDisproportionate(0, 10)).toBe(false)
    })

    test('guards against a non-positive or non-finite amount', () => {
        expect(isWithdrawFeeDisproportionate(1, 0)).toBe(false)
        expect(isWithdrawFeeDisproportionate(1, Number.NaN)).toBe(false)
    })

    test('honours a custom threshold', () => {
        expect(isWithdrawFeeDisproportionate(0.2, 10, 0.01)).toBe(true) // 2% > 1%
        expect(isWithdrawFeeDisproportionate(0.2, 10, 0.1)).toBe(false) // 2% < 10%
    })

    test('default threshold is 5%', () => {
        expect(MAX_WITHDRAW_FEE_RATIO).toBe(0.05)
    })
})
