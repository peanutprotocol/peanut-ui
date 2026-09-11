/**
 * The pay-request confirm shows Rhino's quote only until it expires. The tap
 * decides: an expired quote is re-quoted (the user confirms the fresh
 * numbers), a fresh one is broadcast. Mirrors the withdraw page test.
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

const originalCharge = {
    uuid: 'charge-1',
    chainId: '8453',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenAmount: '10',
    tokenDecimals: 6,
    tokenType: '1',
    tokenSymbol: 'USDC',
    requestLink: {
        recipientAddress: '0x1111111111111111111111111111111111111111',
        recipientAccount: { userId: 'peer-user' },
    },
}

const ctx = {
    amount: '10',
    setAmount: jest.fn(),
    usdAmount: '10',
    setUsdAmount: jest.fn(),
    currentView: 'CONFIRM',
    setCurrentView: jest.fn(),
    parsedUrl: null,
    recipient: {
        recipientType: 'USERNAME',
        identifier: 'alice',
        resolvedAddress: '0x1111111111111111111111111111111111111111',
    },
    chargeIdFromUrl: null,
    isAmountFromUrl: false,
    isTokenFromUrl: false,
    isChainFromUrl: false,
    urlToken: null as { symbol: string; address: string; chainId: string } | null,
    isTokenDenominated: false,
    attachment: {},
    setAttachment: jest.fn(),
    charge: originalCharge as typeof originalCharge | null,
    setCharge: jest.fn(),
    payment: null,
    setPayment: jest.fn(),
    txHash: null,
    setTxHash: jest.fn(),
    error: { showError: false, errorMessage: '' },
    setError: jest.fn(),
    isLoading: false,
    setIsLoading: jest.fn(),
    isSuccess: false,
    setIsSuccess: jest.fn(),
    resetSemanticRequestFlow: jest.fn(),
    isExternalWalletPayment: false,
    setIsExternalWalletPayment: jest.fn(),
}
jest.mock('../SemanticRequestFlowContext', () => ({ useSemanticRequestFlowContext: () => ctx }))

const mockCreateCharge = jest.fn()
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({
        createCharge: mockCreateCharge,
        fetchCharge: jest.fn(),
        isCreating: false,
        isFetching: false,
    }),
}))
const mockRecordPayment = jest.fn().mockResolvedValue({ uuid: 'p1' })
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({
        recordPayment: mockRecordPayment,
        isRecording: false,
        reset: jest.fn(),
    }),
}))

const mockCalculate = jest.fn()
const route = {
    transactions: [{ to: '0x3333333333333333333333333333333333333333', data: '0x' }],
    receiveAmount: '10',
    payAmount: '10',
    feeUsd: 0,
    estimatedGasCostUsd: 0,
    isCalculating: false,
    isFeeEstimationError: false,
    error: null,
    quoteExpiresAt: null as string | null,
    calculate: (...args: unknown[]) => mockCalculate(...args),
    reset: jest.fn(),
}
jest.mock('@/features/payments/shared/hooks/useCrossChainTransfer', () => ({ useCrossChainTransfer: () => route }))

const mockHasSufficientBalance = jest.fn(() => true)
const mockSendMoney = jest.fn()
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        address: '0x2222222222222222222222222222222222222222',
        sendMoney: mockSendMoney,
        sendTransactions: (...args: unknown[]) => mockSendTransactions(...args),
        formattedSpendableBalance: '100',
        hasSufficientSpendableBalance: mockHasSufficientBalance,
        isFetchingSpendableBalance: false,
    }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
const mockTokenSelection = {
    selectedChainID: '8453',
    selectedTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    selectedTokenData: {
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        chainId: '8453',
        decimals: 6,
        symbol: 'USDC',
        price: 1,
    },
    setSelectedChainID: jest.fn(),
    setSelectedTokenAddress: jest.fn(),
}
jest.mock('@/context/tokenSelector.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        tokenSelectorContext: ReactActual.createContext(mockTokenSelection),
    }
})
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn(), refetchQueries: jest.fn() }),
}))
jest.mock('@/constants/query.consts', () => ({ TRANSACTIONS: 'transactions' }))
jest.mock('@/utils/settled-tx-hash.utils', () => ({
    resolveSettledTxHash: (r: { txHash?: string }) => ({ hash: r.txHash ?? '0xmined' }),
}))

import { useSemanticRequestFlow } from '../useSemanticRequestFlow'

describe('useSemanticRequestFlow — quote expiry is decided at the tap', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockSendTransactions.mockResolvedValue({ txHash: '0xmined', receipt: null, strategy: 'smart-only' })
    })
    afterEach(() => jest.useRealTimers())

    it('re-quotes instead of broadcasting when the quote aged out while the confirm sat open', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-01T12:00:00Z') })
        route.quoteExpiresAt = new Date(Date.now() + 60_000).toISOString()
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        const quotesBeforeTap = mockCalculate.mock.calls.length

        jest.setSystemTime(Date.now() + 120_000)
        await act(async () => {
            await result.current.executePayment()
        })

        expect(mockCalculate).toHaveBeenCalledTimes(quotesBeforeTap + 1)
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    it('broadcasts while the quote is still fresh', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-01T12:00:00Z') })
        route.quoteExpiresAt = new Date(Date.now() + 120_000).toISOString()
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        const quotesBeforeTap = mockCalculate.mock.calls.length

        jest.setSystemTime(Date.now() + 10_000)
        await act(async () => {
            await result.current.executePayment()
        })

        expect(mockSendTransactions).toHaveBeenCalled()
        expect(mockCalculate).toHaveBeenCalledTimes(quotesBeforeTap)
    })
})

describe('request self-contributions', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ctx.charge = { ...originalCharge, requestLink: { ...originalCharge.requestLink } }
        ctx.recipient.resolvedAddress = '0x2222222222222222222222222222222222222222'
        ctx.currentView = 'CONFIRM'
        ctx.charge.requestLink.recipientAddress = ctx.recipient.resolvedAddress
        route.quoteExpiresAt = null
        mockSendMoney.mockResolvedValue({ txHash: '0xmined' })
        mockSendTransactions.mockResolvedValue({ txHash: '0xmined' })
        mockCreateCharge.mockResolvedValue(ctx.charge)
        mockTokenSelection.selectedChainID = '8453'
    })

    test.each(['42161', '8453'])('submits and records an existing own request on chain %s', async (chainId) => {
        ctx.charge!.chainId = chainId
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        expect(result.current.canProceed).toBe(true)
        expect(result.current.error.showError).toBe(false)
        await act(async () => {
            await result.current.executePayment()
        })
        if (chainId === '42161') {
            expect(mockSendMoney).toHaveBeenCalledWith(ctx.recipient.resolvedAddress, '10', {
                kind: 'REQUEST_PAY',
                chargeId: 'charge-1',
            })
        } else {
            expect(mockSendTransactions).toHaveBeenCalledTimes(1)
        }
        expect(mockRecordPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                chargeId: 'charge-1',
                txHash: '0xmined',
                payerAddress: ctx.recipient.resolvedAddress,
            })
        )
        expect(ctx.setIsSuccess).toHaveBeenCalledWith(true)
        expect(ctx.setError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    })

    test('allows an existing request belonging to the same user through another wallet', async () => {
        ctx.charge!.requestLink = {
            recipientAddress: originalCharge.requestLink.recipientAddress,
            recipientAccount: { userId: 'u1' },
        }
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        expect(result.current.canProceed).toBe(true)
        await act(async () => {
            await result.current.executePayment()
        })
        expect(mockSendTransactions).toHaveBeenCalledTimes(1)
        expect(mockRecordPayment).toHaveBeenCalledTimes(1)
        expect(ctx.setIsSuccess).toHaveBeenCalledWith(true)
    })

    test.each([false, true])('creates an own-request charge (external wallet: %s)', async (externalWallet) => {
        ctx.charge = null
        ctx.currentView = 'INITIAL'
        mockTokenSelection.selectedChainID = '42161'
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            expect(await result.current.handlePayment(externalWallet)).toEqual({ success: true })
        })
        expect(mockCreateCharge).toHaveBeenCalledWith(
            expect.objectContaining({
                recipientAddress: ctx.recipient.resolvedAddress,
                tokenAmount: '10',
                transactionType: 'REQUEST',
            })
        )
        expect(mockSendMoney).toHaveBeenCalledTimes(externalWallet ? 0 : 1)
        expect(mockRecordPayment).toHaveBeenCalledTimes(externalWallet ? 0 : 1)
    })
})

describe('semantic request USD metadata', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ctx.charge = null
        ctx.currentView = 'INITIAL'
        ctx.amount = '0.1'
        ctx.usdAmount = '0.1'
        ctx.isTokenDenominated = true
        ctx.recipient.recipientType = 'ADDRESS'
        ctx.urlToken = { symbol: 'ETH', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', chainId: '8453' }
        mockTokenSelection.selectedChainID = '8453'
        mockTokenSelection.selectedTokenAddress = ctx.urlToken.address
        mockTokenSelection.selectedTokenData = {
            address: ctx.urlToken.address,
            chainId: '8453',
            decimals: 18,
            symbol: 'ETH',
            price: 2500,
        }
        mockCreateCharge.mockResolvedValue(originalCharge)
    })

    it('prices a preset 0.1 ETH request using the live price, not its token units', async () => {
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            await result.current.handlePayment(true, true)
        })
        expect(mockCreateCharge).toHaveBeenCalledWith(
            expect.objectContaining({ tokenAmount: '0.1', currencyAmount: '250', currencyCode: 'USD' })
        )
    })

    it.each([0, -1, NaN, Infinity])('refuses to create a charge for invalid price %s', async (price) => {
        mockTokenSelection.selectedTokenData.price = price
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            await result.current.handlePayment(true, true)
        })
        expect(mockCreateCharge).not.toHaveBeenCalled()
        expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    })

    it('compares the USD cost with the Peanut wallet balance', () => {
        renderHookWithIntl(() => useSemanticRequestFlow())
        expect(mockHasSufficientBalance).toHaveBeenCalledWith('250')
    })

    it('recalculates a preset amount when the live price arrives', () => {
        mockTokenSelection.selectedTokenData.price = 0
        const { rerender } = renderHookWithIntl(() => useSemanticRequestFlow())
        expect(ctx.setUsdAmount).toHaveBeenLastCalledWith('')
        mockTokenSelection.selectedTokenData.price = 2500
        rerender()
        expect(ctx.setUsdAmount).toHaveBeenLastCalledWith('250')
    })

    it('does not reuse price data from a previous token selection', async () => {
        mockTokenSelection.selectedTokenData.address = '0x1111111111111111111111111111111111111111'
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            await result.current.handlePayment(true, true)
        })
        expect(mockCreateCharge).not.toHaveBeenCalled()
    })
})

describe('semantic request USD denomination with a selected token', () => {
    it('converts a USD amount before requesting ETH', async () => {
        jest.clearAllMocks()
        ctx.charge = null
        ctx.currentView = 'INITIAL'
        ctx.amount = '10'
        ctx.usdAmount = '10'
        ctx.isTokenDenominated = false
        ctx.urlToken = null
        ctx.recipient.recipientType = 'ADDRESS'
        mockTokenSelection.selectedChainID = '8453'
        mockTokenSelection.selectedTokenAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        mockTokenSelection.selectedTokenData = {
            address: mockTokenSelection.selectedTokenAddress,
            chainId: '8453',
            decimals: 18,
            symbol: 'ETH',
            price: 2500,
        }
        mockCreateCharge.mockResolvedValue(originalCharge)
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            await result.current.handlePayment(true, true)
        })
        const payload = mockCreateCharge.mock.calls[0][0]
        expect(Number(payload.tokenAmount)).toBe(0.004)
        expect(payload.currencyAmount).toBe('10')
    })
})
