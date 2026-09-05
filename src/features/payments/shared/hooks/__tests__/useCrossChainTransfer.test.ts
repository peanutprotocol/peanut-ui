/**
 * The hook exposes Rhino's quote verbatim. Regression net for the phantom fee:
 * the bridge path used to set `feeUsd + gasFeeUsd` (double count) and the SDA
 * preview went to the public quote (no depositor/recipient), which priced a fee
 * our account never pays.
 */
import { renderHook, act } from '@testing-library/react'

const mockPreviewSdaTransfer = jest.fn()
const mockProvisionSdaTransfer = jest.fn()
jest.mock('@/services/rhino-sda', () => ({
    previewSdaTransfer: (...args: unknown[]) => mockPreviewSdaTransfer(...args),
    provisionSdaTransfer: (...args: unknown[]) => mockProvisionSdaTransfer(...args),
}))

const mockGetBridgeQuote = jest.fn()
const mockCommitBridgeQuote = jest.fn()
jest.mock('@/services/rhino-bridge', () => ({
    getBridgeQuote: (...args: unknown[]) => mockGetBridgeQuote(...args),
    commitBridgeQuote: (...args: unknown[]) => mockCommitBridgeQuote(...args),
    getBridgeStatus: jest.fn(),
    isQuoteNearExpiry: () => false,
}))

jest.mock('@/constants/rhino.consts', () => ({
    chainIdToRhinoName: (chainId: string) => ({ '42161': 'ARBITRUM', '8453': 'BASE', '1': 'ETHEREUM' })[chainId],
}))
jest.mock('@/constants/chainRegistry.consts', () => ({ NON_EVM_WITHDRAW_CHAINS: {} }))
jest.mock('@/utils/general.utils', () => ({
    areEvmAddressesEqual: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
    getTokenSymbol: (address: string) => (address.startsWith('0xaf88') ? 'USDC' : 'ETH'),
}))
jest.mock('@/utils/peanut-claim.utils', () => ({ prepareRequestLinkFulfillmentTransaction: jest.fn() }))
jest.mock('@/app/actions/tokens', () => ({ estimateTransactionCostUsd: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/interfaces/peanut-sdk-types', () => ({ EPeanutLinkType: { erc20: 1 } }))

import { useCrossChainTransfer } from '../useCrossChainTransfer'

const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const KERNEL = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x1111111111111111111111111111111111111111'

const quote = (feeUsd: number) => ({
    payAmount: (10 + feeUsd).toFixed(6),
    payAmountUsd: 10 + feeUsd,
    receiveAmount: '10',
    receiveAmountUsd: 10,
    feeUsd,
    fees: { gasUsd: feeUsd, sourceGasUsd: 0, platformUsd: 0, percentageUsd: 0 },
    quoteId: 'q-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
})

const source = {
    address: KERNEL as `0x${string}`,
    tokenAddress: USDC_ARB as `0x${string}`,
    chainId: '42161',
    tokenAmount: '10',
}

describe('useCrossChainTransfer — feeUsd is the quote, verbatim', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockProvisionSdaTransfer.mockResolvedValue({
            sdaAddress: '0x3333333333333333333333333333333333333333',
            depositChain: 'ARBITRUM',
            destinationChain: 'BASE',
            destinationAddress: RECIPIENT,
            tokenOut: 'USDC',
            minDepositLimitUsd: 0.5,
            maxDepositLimitUsd: 10000,
        })
        mockCommitBridgeQuote.mockResolvedValue({
            commitmentId: 'ab',
            calldata: { to: '', data: '', value: '' },
            contractAddress: '0x4444444444444444444444444444444444444444',
            kind: 'deposit-with-id',
        })
    })

    it('SDA path: sends depositor/recipient to the preview and exposes feeUsd and payAmount as quoted', async () => {
        mockPreviewSdaTransfer.mockResolvedValue(quote(0))
        const { result } = renderHook(() => useCrossChainTransfer())

        await act(async () => {
            await result.current.calculate({
                source,
                destination: {
                    recipientAddress: RECIPIENT,
                    tokenAddress: USDC_ARB,
                    tokenAmount: '10',
                    tokenDecimals: 6,
                    tokenType: 1,
                    chainId: '8453',
                    tokenSymbol: 'USDC',
                },
                context: 'withdraw',
                contextId: 'charge-1',
            })
        })

        expect(mockPreviewSdaTransfer).toHaveBeenCalledWith(
            expect.objectContaining({ depositor: KERNEL, recipient: RECIPIENT, mode: 'receive', amount: '10' })
        )
        expect(result.current.path).toBe('sda')
        expect(result.current.feeUsd).toBe(0)
        expect(result.current.payAmount).toBe('10.000000')
        expect(result.current.receiveAmount).toBe('10')
        expect(result.current.quoteExpiresAt).toBe('2099-01-01T00:00:00.000Z')
        expect(result.current.error).toBeNull()
    })

    it('bridge path: feeUsd is the quote total, not feeUsd plus a gas component', async () => {
        mockGetBridgeQuote.mockResolvedValue({ ...quote(1.51), isSwap: true })
        const { result } = renderHook(() => useCrossChainTransfer())

        await act(async () => {
            await result.current.calculate({
                source,
                destination: {
                    recipientAddress: RECIPIENT,
                    tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    tokenAmount: '0.004',
                    tokenDecimals: 18,
                    tokenType: 0,
                    chainId: '1',
                    tokenSymbol: 'ETH',
                },
                context: 'withdraw',
                contextId: 'charge-2',
            })
        })

        expect(result.current.path).toBe('bridge')
        expect(result.current.feeUsd).toBe(1.51)
        expect(result.current.payAmount).toBe('11.510000')
        expect(result.current.receiveAmount).toBe('10')
        expect(result.current.error).toBeNull()
    })
})
