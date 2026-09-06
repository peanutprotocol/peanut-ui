/**
 * The pay-request confirm shows Rhino's quote only until it expires. The tap
 * decides: an expired quote is re-quoted (the user confirms the fresh
 * numbers), a fresh one is broadcast. Mirrors the withdraw page test.
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'

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
    urlToken: null,
    isTokenDenominated: false,
    attachment: null,
    setAttachment: jest.fn(),
    charge: {
        uuid: 'charge-1',
        chainId: '8453',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenAmount: '10',
        tokenDecimals: 6,
        tokenType: '1',
        tokenSymbol: 'USDC',
        requestLink: { recipientAddress: '0x1111111111111111111111111111111111111111' },
    },
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

jest.mock('@/features/payments/shared/hooks/useChargeManager', () => ({
    useChargeManager: () => ({ createCharge: jest.fn(), fetchCharge: jest.fn(), isCreating: false, isFetching: false }),
}))
jest.mock('@/features/payments/shared/hooks/usePaymentRecorder', () => ({
    usePaymentRecorder: () => ({
        recordPayment: jest.fn().mockResolvedValue({ uuid: 'p1' }),
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

const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        address: '0x2222222222222222222222222222222222222222',
        sendMoney: jest.fn(),
        sendTransactions: (...args: unknown[]) => mockSendTransactions(...args),
        formattedSpendableBalance: '100',
        hasSufficientSpendableBalance: () => true,
        isFetchingSpendableBalance: false,
    }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/context/tokenSelector.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        tokenSelectorContext: ReactActual.createContext({
            selectedChainID: '8453',
            selectedTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            selectedTokenData: {
                address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                chainId: '8453',
                decimals: 6,
                symbol: 'USDC',
            },
            setSelectedChainID: jest.fn(),
            setSelectedTokenAddress: jest.fn(),
        }),
    }
})
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }))
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
