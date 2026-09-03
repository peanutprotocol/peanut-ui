/**
 * useCrossChainTransfer — the bridge path (destination token outside USDC/USDT)
 * must name its charge on POST /rhino/bridge/quote: that is what makes the API
 * reserve a cap slot and bind the charge to its destination (peanut-api-ts
 * #1497 gates the quote only when contextId is present). claim-xchain has no
 * charge and must NOT send one, or the gate refuses it with 403.
 */
import { renderHook, act } from '@testing-library/react'

const mockGetBridgeQuote = jest.fn()
const mockCommitBridgeQuote = jest.fn()
jest.mock('@/services/rhino-bridge', () => ({
    getBridgeQuote: (...args: unknown[]) => mockGetBridgeQuote(...args),
    commitBridgeQuote: (...args: unknown[]) => mockCommitBridgeQuote(...args),
    getBridgeStatus: jest.fn(),
    isQuoteNearExpiry: () => false,
}))
jest.mock('@/services/rhino-sda', () => ({ previewSdaTransfer: jest.fn(), provisionSdaTransfer: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))
jest.mock('@/app/actions/tokens', () => ({ estimateTransactionCostUsd: jest.fn().mockResolvedValue(0) }))
jest.mock('@/utils/peanut-claim.utils', () => ({ prepareRequestLinkFulfillmentTransaction: jest.fn() }))
jest.mock('@/interfaces/peanut-sdk-types', () => ({}))
jest.mock('@/constants/rhino.consts', () => ({
    chainIdToRhinoName: (id: string) => ({ '42161': 'ARBITRUM', '8453': 'BASE' })[id],
}))
jest.mock('@/constants/chainRegistry.consts', () => ({ NON_EVM_WITHDRAW_CHAINS: {} }))
jest.mock('@/utils/general.utils', () => ({
    areEvmAddressesEqual: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
    getTokenSymbol: () => 'ETH',
}))

import { useCrossChainTransfer } from '../useCrossChainTransfer'

const SOURCE = {
    address: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as `0x${string}`,
    chainId: '42161',
    tokenAmount: '5',
}
const ETH_ON_BASE = {
    recipientAddress: '0x000000000000000000000000000000000000dEaD',
    tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    tokenAmount: '0.002',
    tokenDecimals: 18,
    tokenType: 0,
    chainId: '8453',
}

beforeEach(() => {
    mockGetBridgeQuote.mockReset().mockResolvedValue({
        quoteId: 'quote-1',
        isSwap: false,
        amountIn: '5',
        amountOut: '0.002',
        feeUsd: 0.5,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    mockCommitBridgeQuote.mockReset().mockResolvedValue({
        kind: 'deposit-with-id',
        contractAddress: '0x2222222222222222222222222222222222222222',
        commitmentId: 'ab',
    })
})

describe('useCrossChainTransfer — bridge path names its charge', () => {
    it('withdraw: the bridge quote carries context + contextId so the API can cap it', async () => {
        const { result } = renderHook(() => useCrossChainTransfer())

        await act(async () => {
            await result.current.calculate({
                source: SOURCE,
                destination: ETH_ON_BASE,
                context: 'withdraw',
                contextId: 'charge-1',
                skipGasEstimate: true,
            })
        })

        expect(mockGetBridgeQuote).toHaveBeenCalledTimes(1)
        expect(mockGetBridgeQuote).toHaveBeenCalledWith(
            expect.objectContaining({ chainOut: 'BASE', tokenOut: 'ETH', context: 'withdraw', contextId: 'charge-1' })
        )
        // the commit names the same charge: the API allows one live commitment per charge
        expect(mockCommitBridgeQuote).toHaveBeenCalledWith('quote-1', false, false, {
            context: 'withdraw',
            contextId: 'charge-1',
        })
        expect(result.current.error).toBeNull()
        expect(result.current.transactions).toHaveLength(2)
    })

    it('claim-xchain: no charge exists, so no context is sent (the gate would refuse it)', async () => {
        const { result } = renderHook(() => useCrossChainTransfer())

        await act(async () => {
            await result.current.calculate({
                source: SOURCE,
                destination: ETH_ON_BASE,
                context: 'claim-xchain',
                contextId: 'pubkey-1',
                skipGasEstimate: true,
            })
        })

        const body = mockGetBridgeQuote.mock.calls[0][0] as Record<string, unknown>
        expect(body).not.toHaveProperty('context')
        expect(body).not.toHaveProperty('contextId')
        expect(mockCommitBridgeQuote.mock.calls[0][3]).toBeUndefined()
    })
})
