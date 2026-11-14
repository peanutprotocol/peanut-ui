/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/api-error'

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'

// general.utils reaches the viem clients, whose RPC-ranking timers keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('@/utils/network-triage', () => ({
    captureNetworkTriagedFailure: jest.fn(),
    isNetworkLayerFailure: () => false,
}))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (error: unknown) => `friendly: ${(error as Error).message}`,
}))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser, user: { user: { userId: 'u1' } } }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ sendTransactions: jest.fn() }) }))
const mockOpen = jest.fn()
const mockSubmit = jest.fn()
jest.mock('@/services/pix', () => ({
    pixApi: {
        openWithdrawal: (request: unknown) => mockOpen(request),
        reportFunding: jest.fn(),
        submitWithdrawal: (request: unknown) => mockSubmit(request),
    },
}))
const mockSignSpend = jest.fn()
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({
    useSignSpendBundle: () => ({ signSpend: (input: unknown) => mockSignSpend(input) }),
}))
jest.mock('@/hooks/wallet/useRainControllerRepair', () => ({ useRainControllerRepair: () => jest.fn() }))
jest.mock('@/hooks/wallet/useSignedSpendRecovery', () => ({
    useSignedSpendRecovery: () => () => Promise.resolve(null),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: null }) }))

import { usePixWithdrawSubmit } from '../usePixWithdrawSubmit'

/**
 * Confirm of a Pix payout through Bridge (API-CONTRACT.md section 6): the open already names the
 * withdrawal (its id is the price lock), the reais are an estimate, and a 502 on the submit means
 * the outcome is unknown: the app never asks for a second signature, it reads the withdrawal.
 */
const INTENT = '22222222-2222-4222-8222-222222222222'
const REQUEST = { pixKey: '11144477735', amountBrl: '100' }
const display = {
    amountBrl: '100.00',
    pixKey: '11144477735',
    ownAccount: false,
    holderName: 'BRUNO LIMA',
    bankName: 'Nu Pagamentos S.A.',
    withdrawUsd: '18.87',
    rate: '5.30',
    fixedFeeBrl: '0',
    arrivalEstimateSeconds: 300,
    provider: 'Bridge',
    amountBrlEstimated: true as const,
}
const opened = (shown: Partial<typeof display> = {}) => ({
    provider: 'bridge',
    intentId: INTENT,
    display: { ...display, ...shown },
    sign: {
        kind: 'transfer-then-submit',
        depositAddress: '0x00000000000000000000000000000000000000d3',
        tokenAddress: USDC,
        payAmount: shown.withdrawUsd ?? display.withdrawUsd,
        payAmountUnits: String(Math.round(Number(shown.withdrawUsd ?? display.withdrawUsd) * 1e6)),
        priceLockCode: INTENT,
        quoteExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    },
})
const artifact = {
    strategy: 'smart-only',
    signedUserOp: { signedUserOp: { sender: '0xabc' }, chainId: '42161', entryPointAddress: '0xe' },
}
const dismissed = () => Object.assign(new Error('The operation was not allowed.'), { name: 'NotAllowedError' })
const mark = () => window.localStorage.getItem(`pix-withdraw-pending:u1:${INTENT}`)

describe('usePixWithdrawSubmit on a Bridge payout', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    beforeEach(() => {
        jest.clearAllMocks()
        window.localStorage.clear()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    it('reads a 502 on the submit as unknown: no second signature, and the withdrawal it reads is the one the open named', async () => {
        mockOpen.mockResolvedValue(opened())
        mockSignSpend.mockResolvedValue(artifact)
        mockSubmit.mockRejectedValue(
            new ApiError('Pix is not available right now.', { status: 502, code: 'PROVIDER_UNAVAILABLE' })
        )
        const onOpened = jest.fn()
        const { result } = renderHook(() => usePixWithdrawSubmit({ onOpened }), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(result.current.phase).toBe('unconfirmed')
        expect(result.current.canSignOpened).toBe(false)
        // the last step reads this withdrawal's history, never a new Confirm
        expect(onOpened).toHaveBeenCalledWith(INTENT)
        // a reload elsewhere finds the same withdrawal by its mark
        expect(JSON.parse(mark()!)).toMatchObject({ priceLockCode: INTENT, intentId: INTENT })
        // nothing signs again, however often Confirm is called
        await act(async () => {
            await result.current.confirmOpened()
            await result.current.submit(REQUEST, display)
        })
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockSubmit).toHaveBeenCalledTimes(1)
        expect(mockOpen).toHaveBeenCalledTimes(1)
    })

    // the other side of the 502 rule: a funding step that failed before any broadcast answers 503
    it('reads a 503 on the submit as nothing sent: the same payout can be signed again', async () => {
        mockOpen.mockResolvedValue(opened())
        mockSignSpend.mockResolvedValue(artifact)
        mockSubmit
            .mockRejectedValueOnce(
                new ApiError('Pix is not available right now.', { status: 503, code: 'PROVIDER_UNAVAILABLE' })
            )
            .mockResolvedValueOnce({ provider: 'bridge', intentId: INTENT, status: 'PENDING' })
        const onOpened = jest.fn()
        const { result } = renderHook(() => usePixWithdrawSubmit({ onOpened }), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(result.current.phase).toBe('opened')
        expect(result.current.canSignOpened).toBe(true)
        expect(onOpened).not.toHaveBeenCalled()
        // refused before the broadcast: no mark to wait on
        expect(mark()).toBeNull()

        await act(async () => {
            await result.current.confirmOpened()
        })
        expect(mockOpen).toHaveBeenCalledTimes(1)
        expect(mockSignSpend).toHaveBeenCalledTimes(2)
        expect(result.current.phase).toBe('funded')
        expect(onOpened).toHaveBeenCalledWith(INTENT)
    })

    it('signs the same withdrawal again after a signature that sent nothing, without opening another', async () => {
        mockOpen.mockResolvedValue(opened())
        mockSignSpend.mockRejectedValueOnce(dismissed()).mockRejectedValueOnce(dismissed()).mockResolvedValue(artifact)
        mockSubmit.mockResolvedValue({ provider: 'bridge', intentId: INTENT, status: 'PENDING' })
        const onOpened = jest.fn()
        const { result } = renderHook(() => usePixWithdrawSubmit({ onOpened }), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(result.current.phase).toBe('opened')
        expect(result.current.canSignOpened).toBe(true)
        // Bridge's transfer is open: the URL learns it only once the submit left
        expect(onOpened).not.toHaveBeenCalled()

        // the API claims each submission before it broadcasts: more than one re-sign is safe
        await act(async () => {
            await result.current.confirmOpened()
        })
        expect(result.current.canSignOpened).toBe(true)
        await act(async () => {
            await result.current.confirmOpened()
        })

        expect(mockOpen).toHaveBeenCalledTimes(1)
        expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ priceLockCode: INTENT, amountUsd: '18.87' }))
        expect(result.current.phase).toBe('funded')
        expect(onOpened).toHaveBeenCalledWith(INTENT)
        expect(mark()).toBeNull()
    })

    it('lets the user sign again after a submit the API refused before it broadcast', async () => {
        mockOpen.mockResolvedValue(opened())
        mockSignSpend.mockResolvedValue(artifact)
        mockSubmit.mockRejectedValueOnce(new ApiError('reverted', { status: 422, code: 'USER_OP_REVERTED' }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(result.current.phase).toBe('opened')
        expect(result.current.canSignOpened).toBe(true)
        expect(mark()).toBeNull()
    })

    it.each([
        ['PIX_QUOTE_EXPIRED', 409],
        ['ROUTE_NOT_AVAILABLE', 409],
    ])('starts again when the submit says the withdrawal can no longer be signed (%s)', async (code, status) => {
        mockOpen.mockResolvedValue(opened())
        mockSignSpend.mockResolvedValue(artifact)
        mockSubmit.mockRejectedValueOnce(new ApiError('closed', { status, code }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        // Confirm opens a new withdrawal: this one is closed, and nothing left the wallet
        expect(result.current.phase).toBe('idle')
        expect(result.current.lockedAfterInit).toBe(false)
        expect(mockFetchUser).toHaveBeenCalledTimes(code === 'ROUTE_NOT_AVAILABLE' ? 1 : 0)
    })

    it('shows the open’s figures before the signature when the rate moved in either direction', async () => {
        mockOpen.mockResolvedValue(opened({ amountBrl: '100.35' }))
        mockSignSpend.mockResolvedValue(artifact)
        mockSubmit.mockResolvedValue({ provider: 'bridge', intentId: INTENT, status: 'PENDING' })
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(result.current.phase).toBe('reconfirm')
        expect(result.current.opened?.display.amountBrl).toBe('100.35')
        expect(mockSignSpend).not.toHaveBeenCalled()

        await act(async () => {
            await result.current.confirmOpened()
        })
        expect(result.current.phase).toBe('funded')
    })

    it('reads a repeated submit’s answer as the first one’s: funded once, named once', async () => {
        mockOpen.mockResolvedValue(opened())
        mockSignSpend.mockResolvedValue(artifact)
        // the API answers a submit it already took with that submit's answer
        mockSubmit.mockResolvedValue({ provider: 'bridge', intentId: INTENT, status: 'PENDING' })
        const onOpened = jest.fn()
        const { result } = renderHook(() => usePixWithdrawSubmit({ onOpened }), { wrapper })

        await act(async () => {
            void result.current.submit(REQUEST, display)
            void result.current.submit(REQUEST, display)
        })

        expect(mockOpen).toHaveBeenCalledTimes(1)
        expect(mockSubmit).toHaveBeenCalledTimes(1)
        expect(onOpened).toHaveBeenCalledTimes(1)
        expect(result.current.phase).toBe('funded')
    })
})
