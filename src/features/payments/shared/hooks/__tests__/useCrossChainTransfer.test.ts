/**
 * The hook exposes Rhino's quote verbatim. Regression net for the phantom fee:
 * the bridge path used to set `feeUsd + gasFeeUsd` (double count) and the SDA
 * preview went to the public quote (no depositor/recipient), which priced a fee
 * our account never pays.
 *
 * Also: the bridge path (destination token outside USDC/USDT) must name its
 * charge on POST /rhino/bridge/quote and /rhino/bridge/commit — that is what
 * makes the API reserve a cap slot and bind the charge to its destination
 * (peanut-api-ts #1497 gates the quote only when contextId is present).
 * claim-xchain has no charge and must NOT send one, or the gate refuses it
 * with 403.
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
    quoteAmounts: (q: { payAmount?: string; amountIn?: string; receiveAmount?: string; amountOut?: string }) => ({
        payAmount: q.payAmount ?? q.amountIn ?? '',
        receiveAmount: q.receiveAmount ?? q.amountOut ?? '',
    }),
}))

jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (e: unknown) => (e instanceof Error ? e.message : String(e)),
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
jest.mock('@/app/actions/tokens', () => ({ estimateTransactionCostUsd: jest.fn().mockResolvedValue(0) }))
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

    it('SDA withdraw: quotes pay mode by the source amount, so a full-balance withdraw never needs more than the balance', async () => {
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
            expect.objectContaining({ depositor: KERNEL, recipient: RECIPIENT, mode: 'pay', amount: '10' })
        )
        expect(result.current.path).toBe('sda')
        expect(result.current.feeUsd).toBe(0)
        expect(result.current.payAmount).toBe('10.000000')
        expect(result.current.receiveAmount).toBe('10')
        expect(result.current.quoteExpiresAt).toBe('2099-01-01T00:00:00.000Z')
        expect(result.current.error).toBeNull()
    })

    it('SDA pay-request: quotes receive mode by the destination amount (the payer covers any fee)', async () => {
        mockPreviewSdaTransfer.mockResolvedValue(quote(0))
        const { result } = renderHook(() => useCrossChainTransfer())

        await act(async () => {
            await result.current.calculate({
                source: { ...source, tokenAmount: undefined },
                destination: {
                    recipientAddress: RECIPIENT,
                    tokenAddress: USDC_ARB,
                    tokenAmount: '10',
                    tokenDecimals: 6,
                    tokenType: 1,
                    chainId: '8453',
                    tokenSymbol: 'USDC',
                },
                context: 'pay-request',
                contextId: 'charge-3',
            })
        })

        expect(mockPreviewSdaTransfer).toHaveBeenCalledWith(expect.objectContaining({ mode: 'receive', amount: '10' }))
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

    // A max withdrawal re-quotes on every sub-cent balance change, so two
    // calculates are routinely in flight. If the older one lands last it used to
    // overwrite the newer numbers — and the affordability gate would then be
    // checking a payAmount the user is not about to send.
    it('a superseded quote landing last does not overwrite the newer one', async () => {
        let releaseFirst: (v: unknown) => void = () => {}
        const first = new Promise((res) => {
            releaseFirst = res
        })
        mockGetBridgeQuote
            .mockImplementationOnce(async () => {
                await first
                return { ...quote(1.51), payAmount: '10.126123', isSwap: true }
            })
            .mockImplementationOnce(async () => ({ ...quote(1.51), payAmount: '10.129999', isSwap: true }))

        const { result } = renderHook(() => useCrossChainTransfer())
        const destination = {
            recipientAddress: RECIPIENT,
            tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
            tokenAmount: '0.004',
            tokenDecimals: 18,
            tokenType: 0,
            chainId: '1',
            tokenSymbol: 'ETH',
        }

        await act(async () => {
            // A is in flight and stuck; B starts and finishes.
            const a = result.current.calculate({ source, destination, context: 'withdraw', contextId: 'charge-A' })
            await result.current.calculate({ source, destination, context: 'withdraw', contextId: 'charge-B' })
            releaseFirst(undefined)
            await a
        })

        // B is newer, so B's numbers stand even though A resolved last.
        expect(result.current.payAmount).toBe('10.129999')
    })

    // Deploy order: this build must also work against an API that predates the
    // payAmount/receiveAmount rename and still sends amountIn/amountOut.
    it('bridge path: reads the pre-rename amountIn/amountOut when that is all the API sends', async () => {
        const { payAmount, receiveAmount, ...rest } = quote(1.51)
        mockGetBridgeQuote.mockResolvedValue({ ...rest, amountIn: payAmount, amountOut: receiveAmount, isSwap: true })
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
                contextId: 'charge-3',
            })
        })

        expect(result.current.path).toBe('bridge')
        expect(result.current.payAmount).toBe('11.510000')
        expect(result.current.receiveAmount).toBe('10')
        expect(result.current.error).toBeNull()
    })
})

describe('useCrossChainTransfer — bridge path names its charge', () => {
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
        jest.clearAllMocks()
        mockGetBridgeQuote.mockResolvedValue({
            quoteId: 'quote-1',
            isSwap: false,
            amountIn: '5',
            amountOut: '0.002',
            feeUsd: 0.5,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
        mockCommitBridgeQuote.mockResolvedValue({
            kind: 'deposit-with-id',
            contractAddress: '0x2222222222222222222222222222222222222222',
            commitmentId: 'ab',
        })
    })

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
