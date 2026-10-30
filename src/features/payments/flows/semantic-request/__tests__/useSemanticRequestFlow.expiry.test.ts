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
    chargeIdFromUrl: null as string | null,
    isAmountFromUrl: false,
    isTokenFromUrl: false,
    isChainFromUrl: false,
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
const mockFetchCharge = jest.fn()
jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({
        createCharge: mockCreateCharge,
        fetchCharge: (...args: unknown[]) => mockFetchCharge(...args),
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
        address: '0x2222222222222222222222222222222222222222',
        sendMoney: mockSendMoney,
        sendTransactions: (...args: unknown[]) => mockSendTransactions(...args),
        formattedSpendableBalance: '100',
        hasSufficientSpendableBalance: mockHasSufficientBalance,
        isFetchingSpendableBalance: false,
    }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
const mockRefetchTokenData = jest.fn()
const mockTokenSelection = {
    refetchTokenData: mockRefetchTokenData,
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
    PEANUT_WALLET_TOKEN_SYMBOL: 'USDC',
}))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn(), refetchQueries: jest.fn() }),
}))
jest.mock('@/constants/query.consts', () => ({ TRANSACTIONS: 'transactions' }))
const mockSetChargeAmount = jest.fn()
jest.mock('@/services/charges', () => ({
    chargesApi: { setAmount: (...args: unknown[]) => mockSetChargeAmount(...args) },
}))
jest.mock('@/utils/settled-tx-hash.utils', () => ({
    resolveSettledTxHash: (r: { txHash?: string }) => ({ hash: r.txHash ?? '0xmined' }),
}))

import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { SpendRecoveryAbortedError } from '@/hooks/wallet/signSpendRetry'

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

/**
 * The spend engine's pre-prepare controller check can end the attempt before
 * anything is prepared or signed — a dismissed card re-approval, or the screen
 * left. The charge stays open, so this is not a failed payment.
 */
describe('useSemanticRequestFlow — card re-approval cancelled before signing', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // A live quote — the expiry suite above leaves a stale one behind, and
        // an expired quote returns before the spend is ever attempted.
        route.quoteExpiresAt = null
    })

    it('shows no failure and records nothing when the spend aborts', async () => {
        mockSendTransactions.mockRejectedValue(new SpendRecoveryAbortedError(new Error('grant dismissed')))
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())

        await act(async () => {
            await result.current.executePayment()
        })

        expect(ctx.setError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
        expect(mockRecordPayment).not.toHaveBeenCalled()
        expect(ctx.setIsSuccess).not.toHaveBeenCalled()
        expect(ctx.setIsLoading).toHaveBeenLastCalledWith(false)
    })

    it('a real send failure still surfaces', async () => {
        mockSendTransactions.mockRejectedValue(new Error('bundler 502'))
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())

        await act(async () => {
            await result.current.executePayment()
        })

        expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
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
        mockTokenSelection.selectedTokenData.chainId = '42161'
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

/**
 * A request sent with no amount (TASK-22123): the requestee types one, and it
 * is set on the charge before any money moves, because every payment path
 * reads the amount from the charge.
 */
describe('open-amount requests', () => {
    const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'

    beforeEach(() => {
        jest.clearAllMocks()
        ctx.charge = {
            ...originalCharge,
            chainId: '42161',
            tokenAmount: null,
            openAmount: true,
            requestLink: { ...originalCharge.requestLink },
        } as unknown as typeof originalCharge
        ctx.currentView = 'INITIAL'
        ctx.chargeIdFromUrl = null
        // the field holds "12." while the requestee is still typing
        ctx.amount = '12.'
        ctx.usdAmount = ''
        ctx.recipient.recipientType = 'USERNAME'
        ctx.recipient.resolvedAddress = originalCharge.requestLink.recipientAddress
        mockTokenSelection.selectedChainID = '42161'
        mockTokenSelection.selectedTokenAddress = ARB_USDC
        mockTokenSelection.selectedTokenData = {
            address: ARB_USDC,
            chainId: '42161',
            decimals: 6,
            symbol: 'USDC',
            price: 1,
        }
        mockSetChargeAmount.mockResolvedValue(undefined)
        mockSendMoney.mockResolvedValue({ txHash: '0xmined' })
    })

    it('sets the typed amount on the charge, then pays that amount', async () => {
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            expect(await result.current.handlePayment()).toEqual({ success: true })
        })
        expect(mockSetChargeAmount).toHaveBeenCalledWith('charge-1', '12')
        expect(mockSetChargeAmount.mock.invocationCallOrder[0]).toBeLessThan(mockSendMoney.mock.invocationCallOrder[0])
        expect(mockSendMoney).toHaveBeenCalledWith(originalCharge.requestLink.recipientAddress, '12', {
            kind: 'REQUEST_PAY',
            chargeId: 'charge-1',
        })
        expect(ctx.setCharge).toHaveBeenCalledWith(
            expect.objectContaining({ tokenAmount: '12', currencyAmount: '12', openAmount: true })
        )
        expect(mockRecordPayment).toHaveBeenCalledWith(expect.objectContaining({ chargeId: 'charge-1' }))
        expect(mockCreateCharge).not.toHaveBeenCalled()
    })

    it('moves no money when the amount cannot be set', async () => {
        mockSetChargeAmount.mockRejectedValue(new Error('This request can no longer be changed'))
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            expect(await result.current.handlePayment()).toEqual({ success: false })
        })
        expect(mockSendMoney).not.toHaveBeenCalled()
        expect(mockRecordPayment).not.toHaveBeenCalled()
        expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
    })

    it('opens a fetched open-amount charge on the amount view, not the confirm', async () => {
        const fetched = { ...ctx.charge, fulfillmentPayment: null }
        ctx.charge = null
        ctx.chargeIdFromUrl = 'charge-1'
        ctx.currentView = 'CONFIRM'
        mockFetchCharge.mockResolvedValue(fetched)
        renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {})
        expect(mockFetchCharge).toHaveBeenCalledWith('charge-1')
        expect(ctx.setCurrentView).toHaveBeenCalledWith('INITIAL')
    })

    it('leaves a fixed-amount charge as it is', async () => {
        ctx.charge = { ...originalCharge, chainId: '42161', requestLink: { ...originalCharge.requestLink } }
        ctx.amount = '10'
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            await result.current.handlePayment()
        })
        expect(mockSetChargeAmount).not.toHaveBeenCalled()
        expect(mockSendMoney).toHaveBeenCalledWith(originalCharge.requestLink.recipientAddress, '10', {
            kind: 'REQUEST_PAY',
            chargeId: 'charge-1',
        })
    })
})

describe('payments during a price-service outage', () => {
    // USDC on Base: a cross-chain request, paid through a quoted route
    beforeEach(() => {
        jest.clearAllMocks()
        mockRefetchTokenData.mockReset()
        route.quoteExpiresAt = null
        ctx.charge = { ...originalCharge }
        ctx.amount = '10'
        ctx.usdAmount = '10'
        ctx.currentView = 'INITIAL'
        ctx.isExternalWalletPayment = false
        ctx.recipient.recipientType = 'ADDRESS'
        ctx.recipient.resolvedAddress = originalCharge.requestLink.recipientAddress
        mockTokenSelection.selectedChainID = '8453'
        mockTokenSelection.selectedTokenAddress = originalCharge.tokenAddress
        mockTokenSelection.selectedTokenData = null as any
        mockSendTransactions.mockResolvedValue({ txHash: '0xmined' })
    })

    it('continues an existing charge, quotes it and pays without fetching a price', async () => {
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            expect(await result.current.handlePayment()).toEqual({ success: true })
            await result.current.prepareRoute()
            await result.current.executePayment()
        })
        expect(mockCreateCharge).not.toHaveBeenCalled()
        expect(mockRefetchTokenData).not.toHaveBeenCalled()
        expect(mockCalculate).toHaveBeenCalledWith(
            expect.objectContaining({
                destination: expect.objectContaining({
                    tokenAddress: originalCharge.tokenAddress,
                    tokenAmount: '10',
                    tokenDecimals: 6,
                    chainId: '8453',
                }),
            })
        )
        expect(mockSendTransactions).toHaveBeenCalledTimes(1)
        expect(mockRecordPayment).toHaveBeenCalledTimes(1)
    })

    it('permits an external wallet to continue an existing charge without a price', async () => {
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            expect(await result.current.handlePayment(true, true)).toEqual({ success: true })
        })
        expect(mockRefetchTokenData).not.toHaveBeenCalled()
        expect(mockCreateCharge).not.toHaveBeenCalled()
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    it('never creates a new charge when the refreshed token data is still missing', async () => {
        ctx.charge = null
        mockRefetchTokenData.mockResolvedValue(null)
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            expect(await result.current.handlePayment(true, true)).toEqual({ success: false })
        })
        expect(mockCreateCharge).not.toHaveBeenCalled()
    })
})

/**
 * A ?chargeId= link skips the URL parser, so its token is checked when the
 * charge loads (TASK-23850). An unpaid request in a token requests no longer
 * take selects nothing for it: the page shows why it can't be paid.
 */
describe('a fetched charge in a token requests no longer take', () => {
    const ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    beforeEach(() => {
        jest.clearAllMocks()
        ctx.charge = null
        ctx.chargeIdFromUrl = 'charge-eth'
        ctx.currentView = 'CONFIRM'
        ctx.amount = ''
    })
    afterEach(() => {
        ctx.chargeIdFromUrl = null
    })

    it('stores the charge and selects neither its token, its chain nor its amount', async () => {
        const fetched = {
            ...originalCharge,
            tokenAddress: ETH,
            tokenSymbol: 'ETH',
            tokenAmount: '0.1',
            tokenDecimals: 18,
            fulfillmentPayment: null,
        }
        mockFetchCharge.mockResolvedValue(fetched)
        renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {})

        expect(ctx.setCharge).toHaveBeenCalledWith(fetched)
        expect(mockTokenSelection.setSelectedTokenAddress).not.toHaveBeenCalled()
        expect(mockTokenSelection.setSelectedChainID).not.toHaveBeenCalled()
        expect(ctx.setAmount).not.toHaveBeenCalled()
        expect(ctx.setCurrentView).not.toHaveBeenCalled()
    })

    it('a USDC charge still selects its token and chain', async () => {
        mockFetchCharge.mockResolvedValue({ ...originalCharge, fulfillmentPayment: null })
        renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {})

        expect(mockTokenSelection.setSelectedTokenAddress).toHaveBeenCalledWith(originalCharge.tokenAddress)
        expect(mockTokenSelection.setSelectedChainID).toHaveBeenCalledWith('8453')
    })
})

/**
 * A request is paid in USDC or USDT at $1 (TASK-23850). Paying one used to
 * wait for a price: while the chain list was still loading, the lookup fell
 * through to /tokens/price, which has no $1 entry for USDC on chains such as
 * Avalanche, and the tap ended in "Token price is unavailable".
 */
describe('paying a USDC or USDT request needs no price', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRefetchTokenData.mockReset()
        mockRefetchTokenData.mockResolvedValue(null)
        route.quoteExpiresAt = null
        ctx.charge = null
        ctx.currentView = 'INITIAL'
        ctx.amount = '10'
        ctx.recipient.recipientType = 'ADDRESS'
        ctx.recipient.resolvedAddress = originalCharge.requestLink.recipientAddress
        // the chain list is still loading, so the context has no token data yet
        mockTokenSelection.selectedTokenData = null as any
        mockCreateCharge.mockResolvedValue(originalCharge)
    })

    it.each([
        ['USDC on Avalanche', '43114', '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', 'USDC'],
        ['USDT on Gnosis', '100', '0x4ecaba5870353805a9f068101a40e0f32ed605c6', 'USDT'],
        ['USDC on Celo', '42220', '0xceba9300f2b948710d2653dd7b07f33a8b32118c', 'USDC'],
        ['the wallet USDC on Arbitrum', '42161', '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'USDC'],
    ])('creates the charge for %s with no price lookup and no error', async (_case, chainId, token, symbol) => {
        mockTokenSelection.selectedChainID = chainId
        mockTokenSelection.selectedTokenAddress = token
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            expect(await result.current.handlePayment(true, true)).toEqual({ success: true })
        })

        expect(mockRefetchTokenData).not.toHaveBeenCalled()
        expect(ctx.setError).not.toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
        expect(mockCreateCharge).toHaveBeenCalledWith(
            expect.objectContaining({
                chainId,
                tokenAddress: token,
                tokenSymbol: symbol,
                tokenDecimals: 6,
                tokenAmount: '10',
                currencyAmount: '10',
                transactionType: 'REQUEST',
            })
        )
    })

    it('still refuses a token that is not USDC or USDT when its price is missing', async () => {
        mockTokenSelection.selectedChainID = '8453'
        mockTokenSelection.selectedTokenAddress = '0x0000000000000000000000000000000000000000'
        const { result } = renderHookWithIntl(() => useSemanticRequestFlow())
        await act(async () => {
            expect(await result.current.handlePayment(true, true)).toEqual({ success: false })
        })

        expect(mockRefetchTokenData).toHaveBeenCalledTimes(1)
        expect(mockCreateCharge).not.toHaveBeenCalled()
        expect(ctx.setError).toHaveBeenCalledWith(
            expect.objectContaining({ showError: true, errorMessage: expect.stringContaining('price is unavailable') })
        )
    })
})
