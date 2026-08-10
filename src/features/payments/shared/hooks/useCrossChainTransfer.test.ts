/**
 * useCrossChainTransfer — calculate() error mapping.
 *
 * Rhino tags an unroutable pair `NoRouteFoundError`; the backend surfaces the
 * tag verbatim inside the thrown message. The hook maps it to
 * ROUTE_NOT_FOUND_ERROR so the Confirm view's existing special-case (Retry →
 * onBack) sends the user back to fix the input. Any other failure passes
 * through verbatim.
 */
import { act, renderHook } from '@testing-library/react'
import { useCrossChainTransfer } from './useCrossChainTransfer'
import { ROUTE_NOT_FOUND_ERROR } from '@/constants/general.consts'
import { previewSdaTransfer } from '@/services/rhino-sda'

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/services/rhino-sda', () => ({
    previewSdaTransfer: jest.fn(),
    provisionSdaTransfer: jest.fn(),
}))
jest.mock('@/services/rhino-bridge', () => ({
    getBridgeQuote: jest.fn(),
    commitBridgeQuote: jest.fn(),
    getBridgeStatus: jest.fn(),
    isQuoteNearExpiry: jest.fn(() => false),
}))
jest.mock('@/utils/peanut-claim.utils', () => ({ prepareRequestLinkFulfillmentTransaction: jest.fn() }))
jest.mock('@/app/actions/tokens', () => ({ estimateTransactionCostUsd: jest.fn() }))

const mockPreview = previewSdaTransfer as jest.Mock

// Cross-chain SDA input: Arbitrum USDC → Solana USDC. tokenSymbol is passed
// explicitly so the test doesn't depend on token-details lookups.
const CALC_INPUT = {
    source: {
        address: '0x1111111111111111111111111111111111111111' as `0x${string}`,
        tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' as `0x${string}`,
        chainId: '42161',
    },
    destination: {
        recipientAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenAmount: '2',
        tokenDecimals: 6,
        tokenType: 1,
        chainId: 'solana',
        tokenSymbol: 'USDC',
    },
    context: 'withdraw' as const,
    contextId: 'charge-uuid-1',
}

describe('useCrossChainTransfer calculate() error mapping', () => {
    afterEach(() => jest.clearAllMocks())

    test('NoRouteFoundError from the preview maps to ROUTE_NOT_FOUND_ERROR', async () => {
        mockPreview.mockRejectedValue(
            new Error('Failed to preview SDA transfer: 400 {"error":"Preview quote failed: NoRouteFoundError"}')
        )
        const { result } = renderHook(() => useCrossChainTransfer())

        await act(() => result.current.calculate(CALC_INPUT))

        expect(result.current.error).toBe(ROUTE_NOT_FOUND_ERROR)
        expect(result.current.isFeeEstimationError).toBe(true)
    })

    test('any other failure passes through verbatim', async () => {
        mockPreview.mockRejectedValue(
            new Error('Failed to preview SDA transfer: 400 {"error":"Preview quote failed: HTTP 404 with empty body"}')
        )
        const { result } = renderHook(() => useCrossChainTransfer())

        await act(() => result.current.calculate(CALC_INPUT))

        expect(result.current.error).toBe(
            'Failed to preview SDA transfer: 400 {"error":"Preview quote failed: HTTP 404 with empty body"}'
        )
    })
})
