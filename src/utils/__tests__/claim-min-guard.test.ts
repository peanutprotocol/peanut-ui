import { belowClaimBridgeMinimum } from '@/utils/claim-min-guard'

// Arbitrum (default floor $0.50), Ethereum mainnet ($5), Tron ($10).
const ARBITRUM = '42161'
const ETHEREUM = '1'
const TRON = 'tron'

describe('belowClaimBridgeMinimum', () => {
    it('does not block a same-chain (non-Rhino) claim', () => {
        expect(belowClaimBridgeMinimum({ isXChain: false, destinationChainId: ETHEREUM, amountUsd: 0.01 })).toBeNull()
    })

    it('does not block when the USD amount is unknown (server-side guard is the backstop)', () => {
        expect(belowClaimBridgeMinimum({ isXChain: true, destinationChainId: ETHEREUM, amountUsd: null })).toBeNull()
        expect(belowClaimBridgeMinimum({ isXChain: true, destinationChainId: ETHEREUM, amountUsd: NaN })).toBeNull()
    })

    it('blocks below the per-chain floor and reports the minimum', () => {
        expect(belowClaimBridgeMinimum({ isXChain: true, destinationChainId: ARBITRUM, amountUsd: 0.3 })).toEqual({
            minUsd: 0.5,
        })
        expect(belowClaimBridgeMinimum({ isXChain: true, destinationChainId: ETHEREUM, amountUsd: 2 })).toEqual({
            minUsd: 5,
        })
        expect(belowClaimBridgeMinimum({ isXChain: true, destinationChainId: TRON, amountUsd: 4 })).toEqual({
            minUsd: 10,
        })
    })

    it('allows at or above the floor (boundary: equal is allowed)', () => {
        expect(belowClaimBridgeMinimum({ isXChain: true, destinationChainId: ARBITRUM, amountUsd: 0.5 })).toBeNull()
        expect(belowClaimBridgeMinimum({ isXChain: true, destinationChainId: ETHEREUM, amountUsd: 5 })).toBeNull()
        expect(belowClaimBridgeMinimum({ isXChain: true, destinationChainId: ETHEREUM, amountUsd: 12 })).toBeNull()
    })
})
