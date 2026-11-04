/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { decodeFunctionData, erc20Abi, parseAbi } from 'viem'
import { ApiError } from '@/services/api-error'

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const BRIDGE = '0x10417734001162Ea139e8b044DFe28DbB8B28ad0'
const MINED = `0x${'ab'.repeat(32)}`

// general.utils reaches the viem clients, whose RPC-ranking timers keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (error: unknown) => `friendly: ${(error as Error).message}`,
}))
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ sendTransactions: (...args: unknown[]) => mockSendTransactions(...args) }),
}))
const mockInit = jest.fn()
const mockReportFunding = jest.fn()
jest.mock('@/services/avenia', () => ({
    aveniaApi: {
        initWithdrawal: (request: unknown) => mockInit(request),
        reportFunding: (intentId: string, hash: string) => mockReportFunding(intentId, hash),
    },
}))

import { useAveniaWithdrawSubmit } from '../hooks/useAveniaWithdrawSubmit'

const DEPOSIT_ABI = parseAbi(['function depositWithId(address tokenAddress, uint256 amount, uint256 commitmentId)'])
const REQUEST = { pixKey: '09579927189', amountBrl: '503' }
const display = { amountBrl: '503.00', withdrawUsd: '92.504310' }
const initResponse = (overrides: Record<string, unknown> = {}) => ({
    intentId: 'w1',
    display,
    sign: {
        kind: 'deposit-with-id',
        contractAddress: BRIDGE,
        tokenAddress: USDC,
        payAmount: '92.50431',
        payAmountUnits: '92504310',
        commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
        quoteExpiresAt: '2026-11-04T12:03:00.000Z',
        ticketExpiresAt: '2026-11-04T12:10:00.000Z',
        ...overrides,
    },
})

describe('useAveniaWithdrawSubmit', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        jest.clearAllMocks()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        mockReportFunding.mockResolvedValue({ status: 'PROCESSING' })
    })

    it("opens the ticket, signs Rhino's deposit for exactly the pay amount and reports the mined hash", async () => {
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const { result } = renderHook(() => useAveniaWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST)
        })

        expect(mockInit).toHaveBeenCalledWith(REQUEST)
        const [calls, options] = mockSendTransactions.mock.calls[0]
        expect(options).toMatchObject({ chainId: '42161', requiredUsdcAmount: 92_504_310n, kind: 'FIAT_OFFRAMP' })
        expect(calls[0].to).toBe(USDC)
        expect(decodeFunctionData({ abi: erc20Abi, data: calls[0].data }).args).toEqual([BRIDGE, 92_504_310n])
        expect(calls[1].to).toBe(BRIDGE)
        expect(decodeFunctionData({ abi: DEPOSIT_ABI, data: calls[1].data }).args).toEqual([
            USDC,
            92_504_310n,
            BigInt('0x6aeb17ea29f84d1e9b0c3a5d7e2f1c08'),
        ])
        expect(mockReportFunding).toHaveBeenCalledWith('w1', MINED)
        expect(result.current.phase).toBe('sent')
        expect(result.current.sent).toEqual({ intentId: 'w1', display })
    })

    it('reports nothing it cannot prove: no receipt, no funding report', async () => {
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockResolvedValue({ receipt: null })
        const { result } = renderHook(() => useAveniaWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST)
        })

        expect(result.current.phase).toBe('sent')
        expect(mockReportFunding).not.toHaveBeenCalled()
    })

    it.each([
        ['AVENIA_LIMIT_EXCEEDED', 'withdraw.errors.limitExceeded'],
        ['WITHDRAWAL_IN_PROGRESS', 'withdraw.errors.inProgress'],
        ['AVENIA_TICKET_WINDOW_SHORT', 'withdraw.errors.quoteExpired'],
        ['PIX_KEY_NOT_OWN', 'withdraw.keyNotOwn'],
        ['PROVIDER_REJECTED', 'providerRejected'],
        ['PROVIDER_UNAVAILABLE', 'unavailable'],
    ])('names a refused init (%s) and allows another try', async (code, message) => {
        mockInit.mockRejectedValue(new ApiError('refused', { status: 422, code }))
        const { result } = renderHook(() => useAveniaWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST)
        })

        expect(result.current.error).toBe(message)
        expect(result.current.lockedAfterInit).toBe(false)
        expect(result.current.phase).toBe('idle')
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    it('never signs again once the ticket is open, even when the signature failed', async () => {
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockRejectedValue(new Error('passkey cancelled'))
        const { result } = renderHook(() => useAveniaWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST)
        })
        expect(result.current.error).toBe('friendly: passkey cancelled')
        expect(result.current.lockedAfterInit).toBe(true)

        await act(async () => {
            await result.current.submit(REQUEST)
        })
        expect(mockInit).toHaveBeenCalledTimes(1)
        expect(mockSendTransactions).toHaveBeenCalledTimes(1)
    })

    it('refuses to approve a token that is not the wallet USDC', async () => {
        mockInit.mockResolvedValue(initResponse({ tokenAddress: '0x0000000000000000000000000000000000000bad' }))
        const { result } = renderHook(() => useAveniaWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST)
        })

        expect(mockSendTransactions).not.toHaveBeenCalled()
        expect(result.current.error).toBe('unavailable')
    })

    it('treats a reverted deposit as a failure, not a sent withdrawal', async () => {
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'reverted', transactionHash: MINED, logs: [] } })
        const { result } = renderHook(() => useAveniaWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST)
        })

        expect(result.current.phase).toBe('idle')
        expect(result.current.sent).toBeNull()
        expect(mockReportFunding).not.toHaveBeenCalled()
    })
})
