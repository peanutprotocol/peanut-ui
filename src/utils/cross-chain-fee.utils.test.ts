import {
    isWithdrawFeeDisproportionate,
    getMinWithdrawUsdForChain,
    HIGH_WITHDRAW_FEE_RATIO,
    MIN_CRYPTO_WITHDRAW_USD,
    ETHEREUM_MIN_WITHDRAW_USD,
} from './cross-chain-fee.utils'
import { NON_EVM_WITHDRAW_CHAINS } from '@/constants/chainRegistry.consts'
import chainDetails from '@/constants/chain-details.json'

describe('isWithdrawFeeDisproportionate', () => {
    test('no heads-up for a tiny L2 fee on a normal amount', () => {
        // $0.08 fee on $10 → 0.8%
        expect(isWithdrawFeeDisproportionate(0.08, 10)).toBe(false)
    })

    test('heads-up for a small mainnet withdraw where flat gas dominates', () => {
        // $1.50 fee on $10 → 15%
        expect(isWithdrawFeeDisproportionate(1.5, 10)).toBe(true)
    })

    test('no heads-up for the same mainnet fee on a larger amount', () => {
        // $1.50 fee on $100 → 1.5%
        expect(isWithdrawFeeDisproportionate(1.5, 100)).toBe(false)
    })

    test('is strict at the threshold boundary', () => {
        // exactly 5% is below the line; just over triggers the heads-up
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
        expect(HIGH_WITHDRAW_FEE_RATIO).toBe(0.05)
    })
})

describe('getMinWithdrawUsdForChain', () => {
    test('Ethereum mainnet needs $5, string or numeric chainId', () => {
        expect(getMinWithdrawUsdForChain('1')).toBe(5)
        expect(getMinWithdrawUsdForChain(1)).toBe(5)
        expect(getMinWithdrawUsdForChain('1')).toBe(ETHEREUM_MIN_WITHDRAW_USD)
    })

    test('Tron needs $10 — both the picker slug and the numeric id', () => {
        // the withdraw picker supplies 'tron' (NON_EVM_WITHDRAW_CHAINS slug)
        expect(getMinWithdrawUsdForChain('tron')).toBe(10)
        expect(getMinWithdrawUsdForChain('728126428')).toBe(10)
    })

    test('every other network floors at $0.50', () => {
        expect(getMinWithdrawUsdForChain('42161')).toBe(0.5) // Arbitrum (same-chain)
        expect(getMinWithdrawUsdForChain('8453')).toBe(0.5) // Base
        expect(getMinWithdrawUsdForChain('10')).toBe(0.5) // Optimism — NOT Ethereum's '1'
        expect(getMinWithdrawUsdForChain('unknown-chain')).toBe(MIN_CRYPTO_WITHDRAW_USD)
    })

    test('the REAL chain records the withdraw flow supplies hit the intended minimums', () => {
        // Anti-drift: the original version of this map keyed Tron by its
        // numeric chain id, which no picker record ever carries — the $10
        // floor was dead code and the hand-typed-id test passed vacuously.
        // Assert against the records the flow actually passes to the guard.
        const tron = NON_EVM_WITHDRAW_CHAINS['tron']
        expect(tron).toBeDefined()
        expect(getMinWithdrawUsdForChain(tron.chainId)).toBe(10)

        expect((chainDetails as Record<string, unknown>)['1']).toBeDefined()
        expect(getMinWithdrawUsdForChain('1')).toBe(ETHEREUM_MIN_WITHDRAW_USD)
    })
})
