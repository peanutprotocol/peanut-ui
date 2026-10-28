/**
 * TASK-23856: Rhino says "completed" before the API books the payment. The
 * semantic-request flow reads the charge until it is final, and stops when
 * the payer leaves the deposit screen.
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
    currentView: 'EXTERNAL_WALLET',
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

describe('useSemanticRequestFlow — external-wallet read-back', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
    })
    afterEach(() => jest.useRealTimers())

    const start = () => {
        const hook = renderHookWithIntl(() => useSemanticRequestFlow())
        let done: Promise<void> | undefined
        act(() => {
            done = hook.result.current.completeExternalWalletPayment()
        })
        return { ...hook, done: () => done }
    }

    it('waits through PROCESSING reads, then shows the result', async () => {
        const booked = { ...originalCharge, status: 'COMPLETED', settledAmount: '10' }
        mockFetchCharge
            .mockResolvedValueOnce({ ...originalCharge, status: 'PROCESSING' })
            .mockResolvedValueOnce({ ...originalCharge, status: 'PROCESSING' })
            .mockResolvedValueOnce(booked)
        const { done } = start()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(6_000)
            await done()
        })

        expect(mockFetchCharge).toHaveBeenCalledTimes(3)
        expect(ctx.setIsLoading).toHaveBeenNthCalledWith(1, true)
        expect(ctx.setIsLoading).toHaveBeenLastCalledWith(false)
        expect(ctx.setCharge).toHaveBeenLastCalledWith(booked)
        expect(ctx.setIsExternalWalletPayment).toHaveBeenCalledWith(true)
        expect(ctx.setCurrentView).toHaveBeenCalledWith('STATUS')
    })

    it('a failed charge goes back to the amount screen with an error', async () => {
        mockFetchCharge.mockResolvedValue({ ...originalCharge, status: 'FAILED' })
        const { done } = start()
        await act(async () => {
            await done()
        })

        expect(ctx.setError).toHaveBeenCalledWith(expect.objectContaining({ showError: true }))
        expect(ctx.setCurrentView).toHaveBeenCalledWith('INITIAL')
        expect(ctx.setCurrentView).not.toHaveBeenCalledWith('STATUS')
    })

    it('leaving the deposit screen mid-read stops it', async () => {
        mockFetchCharge.mockResolvedValue({ ...originalCharge, status: 'PROCESSING' })
        const { unmount, done } = start()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_000)
        })
        unmount()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000)
            await done()
        })

        expect(ctx.setCurrentView).not.toHaveBeenCalled()
        expect(ctx.setIsLoading).toHaveBeenLastCalledWith(false)
    })
})
