/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/api-error'
import { BALANCE_DECREASE, SEND_MONEY } from '@/constants/query.consts'

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'

// general.utils reaches the viem clients, whose RPC-ranking timers keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
const mockCaptureTriaged = jest.fn()
jest.mock('@/utils/network-triage', () => ({
    captureNetworkTriagedFailure: (...args: unknown[]) => mockCaptureTriaged(...args),
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
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ sendTransactions: (...args: unknown[]) => mockSendTransactions(...args) }),
}))
const mockInit = jest.fn()
const mockReportFunding = jest.fn()
const mockSubmitTransfer = jest.fn()
jest.mock('@/services/pix', () => ({
    pixApi: {
        openWithdrawal: (request: unknown) => mockInit(request),
        reportFunding: (intentId: string, hash: string) => mockReportFunding(intentId, hash),
        submitWithdrawal: (request: unknown) => mockSubmitTransfer(request),
    },
}))
// the transfer-then-submit signature: the card-aware signer, and its recovery, which finds nothing to replace
const mockSignSpend = jest.fn()
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({
    useSignSpendBundle: () => ({ signSpend: (input: unknown) => mockSignSpend(input) }),
}))
jest.mock('@/hooks/wallet/useRainControllerRepair', () => ({ useRainControllerRepair: () => jest.fn() }))
jest.mock('@/hooks/wallet/useSignedSpendRecovery', () => ({
    useSignedSpendRecovery: () => () => Promise.resolve(null),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: { balance: { spendingPower: 1250 } } }),
}))

import { usePixWithdrawSubmit } from '../usePixWithdrawSubmit'

const REQUEST = { pixKey: '09579927189', amountBrl: '503' }
const display = {
    amountBrl: '503.00',
    pixKey: '09579927189',
    ownAccount: null,
    holderName: 'Ana Souza',
    bankName: null,
    withdrawUsd: '92.504310',
    rate: '5.437586',
    fixedFeeBrl: '0',
    arrivalEstimateSeconds: 300,
    provider: 'Manteca' as const,
}
const inAMinute = () => new Date(Date.now() + 60_000).toISOString()
const units = (usd: string) => {
    const [whole, fraction = ''] = usd.split('.')
    return BigInt(whole + fraction.padEnd(6, '0').slice(0, 6)).toString()
}
// Manteca's kind: nothing is open until the API takes the signed transfer, opens the order and broadcasts
const DEPOSIT_ADDRESS = '0x00000000000000000000000000000000000000d3'
const transferInit = (overrides: Record<string, unknown> = {}, opened: Partial<typeof display> = {}) => ({
    provider: 'manteca',
    intentId: null,
    display: { ...display, ...opened },
    sign: {
        kind: 'transfer-then-submit',
        depositAddress: DEPOSIT_ADDRESS,
        tokenAddress: USDC,
        payAmount: opened.withdrawUsd ?? display.withdrawUsd,
        payAmountUnits: units(opened.withdrawUsd ?? display.withdrawUsd),
        priceLockCode: 'lock-1',
        quoteExpiresAt: inAMinute(),
        ...overrides,
    },
})
const signedUserOp = { sender: '0xabc', nonce: 1n, callData: '0x', signature: '0x1' }
const artifact = {
    strategy: 'smart-only',
    signedUserOp: { signedUserOp, chainId: '42161', entryPointAddress: '0xe' },
}
const submitted = { provider: 'manteca', intentId: 'm1', status: 'PROCESSING' }

describe('usePixWithdrawSubmit', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    beforeEach(() => {
        jest.clearAllMocks()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        mockReportFunding.mockResolvedValue({ status: 'PROCESSING' })
    })

    it('submits as a balance-decreasing send, so the pending guard sees it', async () => {
        window.localStorage.clear()
        mockInit.mockResolvedValue(transferInit())
        mockSignSpend.mockResolvedValue(artifact)
        let seen = 0
        mockSubmitTransfer.mockImplementation(async () => {
            seen = queryClient.isMutating({ mutationKey: [BALANCE_DECREASE] })
            return submitted
        })
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(seen).toBe(1)
    })

    it('opens no withdrawal while another balance-decreasing send is pending', async () => {
        void queryClient
            .getMutationCache()
            .build(queryClient, {
                mutationKey: [BALANCE_DECREASE, SEND_MONEY],
                mutationFn: () => new Promise(() => {}),
            })
            .execute(undefined)
        const { result, rerender } = renderHook(() => usePixWithdrawSubmit(), { wrapper })
        rerender()

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(mockInit).not.toHaveBeenCalled()
    })

    it('reports an unexplained signing failure with the critical-flow tags', async () => {
        window.localStorage.clear()
        mockInit.mockResolvedValue(transferInit())
        mockSignSpend.mockRejectedValue(new Error('bundler said no'))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(mockCaptureTriaged).toHaveBeenCalledWith(expect.any(Error), {
            tags: { critical_flow: 'withdraw-pix', withdraw_step: 'sign' },
            extra: { intentId: null },
        })
    })

    it("reports an init that failed without the API's refusal code, and not a refusal", async () => {
        mockInit.mockRejectedValueOnce(new ApiError('refused', { status: 422, code: 'PIX_KEY_NOT_OWN' }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })
        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(mockCaptureTriaged).not.toHaveBeenCalled()

        mockInit.mockRejectedValueOnce(new TypeError('Failed to fetch'))
        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(mockCaptureTriaged).toHaveBeenCalledWith(expect.any(TypeError), {
            tags: { critical_flow: 'withdraw-pix', withdraw_step: 'init' },
        })
    })

    it.each([
        ['PIX_LIMIT_EXCEEDED', 'withdraw.errors.limitExceeded'],
        ['WITHDRAWAL_IN_PROGRESS', 'withdraw.errors.inProgress'],
        ['PIX_QUOTE_EXPIRED', 'withdraw.errors.quoteExpired'],
        ['PIX_KEY_NOT_OWN', 'withdraw.keyNotOwn'],
        ['PROVIDER_REJECTED', 'providerRejected'],
        ['PROVIDER_UNAVAILABLE', 'unavailable'],
    ])('names a refused init (%s) and allows another try', async (code, message) => {
        mockInit.mockRejectedValue(new ApiError('refused', { status: 422, code }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(result.current.error).toBe(message)
        expect(result.current.lockedAfterInit).toBe(false)
        expect(result.current.phase).toBe('idle')
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    it.each([
        ['ROUTE_NOT_AVAILABLE', true],
        ['PROVIDER_UNAVAILABLE', true],
        ['PIX_LIMIT_EXCEEDED', false],
    ])('reads the route again when init says it moved (%s)', async (code, rereads) => {
        mockInit.mockRejectedValue(new ApiError('refused', { status: 403, code }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(mockFetchUser).toHaveBeenCalledTimes(rereads ? 1 : 0)
    })

    it('opens one withdrawal for two taps in the same tick', async () => {
        mockInit.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            void result.current.submit(REQUEST, display)
            void result.current.submit(REQUEST, display)
        })

        expect(mockInit).toHaveBeenCalledTimes(1)
        expect(result.current.phase).toBe('starting')
    })

    it('refuses to sign for a token that is not the wallet USDC', async () => {
        mockInit.mockResolvedValue(transferInit({ tokenAddress: '0x0000000000000000000000000000000000000bad' }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(result.current.error).toBe('unavailable')
    })

    it('signs nothing when the opened quote takes more USD than the review showed, until confirmed again', async () => {
        window.localStorage.clear()
        mockInit.mockResolvedValue(transferInit({}, { withdrawUsd: '93.100000' }))
        mockSignSpend.mockResolvedValue(artifact)
        mockSubmitTransfer.mockResolvedValue(submitted)
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(result.current.phase).toBe('reconfirm')
        expect(result.current.opened?.display.withdrawUsd).toBe('93.100000')
        expect(mockSignSpend).not.toHaveBeenCalled()

        await act(async () => {
            await result.current.confirmOpened()
        })
        expect(mockSignSpend).toHaveBeenCalledTimes(1)
        expect(mockSignSpend.mock.calls[0][0]).toMatchObject({ requiredUsdcAmount: 93_100_000n })
        expect(mockInit).toHaveBeenCalledTimes(1)
        expect(result.current.phase).toBe('funded')
    })

    it('asks again when the opened quote pays fewer reais, and signs at once when it is better', async () => {
        window.localStorage.clear()
        mockInit.mockResolvedValueOnce(transferInit({}, { amountBrl: '502.10' }))
        const first = renderHook(() => usePixWithdrawSubmit(), { wrapper })
        await act(async () => {
            await first.result.current.submit(REQUEST, display)
        })
        expect(first.result.current.phase).toBe('reconfirm')

        mockInit.mockResolvedValueOnce(transferInit({}, { withdrawUsd: '92.400000', amountBrl: '503.00' }))
        mockSignSpend.mockResolvedValue(artifact)
        mockSubmitTransfer.mockResolvedValue(submitted)
        const second = renderHook(() => usePixWithdrawSubmit(), { wrapper })
        await act(async () => {
            await second.result.current.submit(REQUEST, display)
        })
        expect(second.result.current.phase).toBe('funded')
    })

    it('signs nothing when the sign request asks for another amount than the opened quote shows', async () => {
        mockInit.mockResolvedValue(transferInit({ payAmount: '95', payAmountUnits: '95000000' }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(result.current.error).toBe('unavailable')
        // nothing opens before the submit, so Confirm may open a new one
        expect(result.current.lockedAfterInit).toBe(false)
    })

    describe('a transfer-then-submit withdrawal', () => {
        const dismissed = () => Object.assign(new Error('The operation was not allowed.'), { name: 'NotAllowedError' })

        // this account's marks: one key per price lock
        const markLocks = () =>
            Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i))
                .filter((key) => key?.startsWith('pix-withdraw-pending:u1:'))
                .map((key) => key!.slice('pix-withdraw-pending:u1:'.length))
        const pendingMark = () => window.localStorage.getItem('pix-withdraw-pending:u1:lock-1')
        beforeEach(() => window.localStorage.clear())

        it('signs a transfer of exactly the pay amount to the deposit address, and opens nothing before the submit', async () => {
            mockInit.mockResolvedValue(transferInit())
            const order: string[] = []
            mockSignSpend.mockImplementation(async () => {
                order.push('sign')
                return artifact
            })
            mockSubmitTransfer.mockImplementation(async () => {
                // the device mark is down before the submit leaves: a reload from here shows it, not a new Confirm
                order.push(`submit, marked ${JSON.parse(pendingMark()!).priceLockCode}`)
                return { provider: 'manteca', intentId: 'm1', status: 'PROCESSING' }
            })
            const onOpened = jest.fn((id: string | null) => order.push(`opened ${id}`))
            const { result } = renderHook(() => usePixWithdrawSubmit({ onOpened }), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })

            expect(mockSignSpend).toHaveBeenCalledWith(
                expect.objectContaining({
                    requiredUsdcAmount: 92_504_310n,
                    recipient: DEPOSIT_ADDRESS,
                    rainSpendingPower: 12_500_000n,
                    kind: 'FIAT_OFFRAMP',
                })
            )
            expect(mockSubmitTransfer).toHaveBeenCalledWith({
                priceLockCode: 'lock-1',
                pixKey: display.pixKey,
                amountUsd: display.withdrawUsd,
                funding: { kind: 'userOp', signedUserOp, chainId: '42161', entryPointAddress: '0xe' },
            })
            // the withdrawal opens at the submit: its id reaches the flow after it, never before the signature
            expect(order).toEqual(['sign', 'submit, marked lock-1', 'opened m1'])
            // a named withdrawal is the URL's: the mark goes
            expect(pendingMark()).toBeNull()
            expect(mockSendTransactions).not.toHaveBeenCalled()
            expect(mockReportFunding).not.toHaveBeenCalled()
            expect(result.current.phase).toBe('funded')
            expect(result.current.opened?.intentId).toBe('m1')
        })

        it('sends a card collateral withdrawal as its own funding kind', async () => {
            mockInit.mockResolvedValue(transferInit())
            const rainWithdrawal = { preparationId: 'p1', amount: '92504310' }
            mockSignSpend.mockResolvedValue({ strategy: 'collateral-only', rainWithdrawal })
            mockSubmitTransfer.mockResolvedValue({ provider: 'manteca', intentId: 'm1', status: 'PROCESSING' })
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })

            expect(mockSubmitTransfer.mock.calls[0][0].funding).toEqual({
                kind: 'rainWithdrawal',
                signedRainWithdrawal: rainWithdrawal,
                chainId: '42161',
            })
        })

        it('goes back to Confirm after a dismissed signature: nothing is open, so a new tap opens a new one', async () => {
            mockInit.mockResolvedValue(transferInit())
            mockSignSpend.mockRejectedValueOnce(dismissed()).mockResolvedValueOnce(artifact)
            mockSubmitTransfer.mockResolvedValue({ provider: 'manteca', intentId: 'm1', status: 'PROCESSING' })
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })
            expect(result.current.phase).toBe('idle')
            expect(result.current.lockedAfterInit).toBe(false)
            expect(mockSubmitTransfer).not.toHaveBeenCalled()

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })
            expect(mockInit).toHaveBeenCalledTimes(2)
            expect(result.current.phase).toBe('funded')
        })

        // two tabs: tab A's submit lost its answer (lock-a); tab B's refusal must not lift A's guard
        it("clears only its own lock's mark on a refusal, never another tab's", async () => {
            window.localStorage.setItem(
                'pix-withdraw-pending:u1:lock-a',
                JSON.stringify({
                    priceLockCode: 'lock-a',
                    display,
                    submittedAt: Date.now() - 30_000,
                    settleBy: Date.now() + 10 * 60_000,
                })
            )
            mockInit.mockResolvedValue(transferInit())
            mockSignSpend.mockResolvedValue(artifact)
            mockSubmitTransfer.mockRejectedValue(
                new ApiError('This Pix key was not found.', { status: 404, code: 'PIX_KEY_NOT_FOUND' })
            )
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })

            expect(result.current.phase).toBe('idle')
            expect(markLocks()).toEqual(['lock-a'])
        })

        it('reads a submit the API refused before it broadcast as nothing sent', async () => {
            mockInit.mockResolvedValue(transferInit())
            mockSignSpend.mockResolvedValue(artifact)
            mockSubmitTransfer.mockRejectedValue(
                new ApiError('This Pix key was not found.', { status: 404, code: 'PIX_KEY_NOT_FOUND' })
            )
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })

            expect(result.current.phase).toBe('idle')
            expect(result.current.error).toBe('pixKey.notFound')
            // refused before the broadcast: nothing to wait for
            expect(pendingMark()).toBeNull()
        })

        it('reads a submit whose answer was lost, or failed after the broadcast, as not confirmed, and keeps the mark', async () => {
            for (const failure of [
                new ApiError('Pix is not available right now.', { status: 502, code: 'PROVIDER_UNAVAILABLE' }),
                new TypeError('Failed to fetch'),
            ]) {
                window.localStorage.clear()
                mockInit.mockResolvedValue(transferInit())
                mockSignSpend.mockResolvedValue(artifact)
                mockSubmitTransfer.mockRejectedValueOnce(failure)
                const onOpened = jest.fn()
                const { result, unmount } = renderHook(() => usePixWithdrawSubmit({ onOpened }), { wrapper })

                await act(async () => {
                    await result.current.submit(REQUEST, display)
                })

                // it may be paying: the last step, never a second Confirm, and the URL drops the form
                expect(result.current.phase).toBe('unconfirmed')
                expect(result.current.canSignOpened).toBe(false)
                expect(result.current.lockedAfterInit).toBe(true)
                expect(onOpened).toHaveBeenCalledWith(null)
                // the device mark outlives this page, so a reload shows the same withdrawal
                expect(JSON.parse(pendingMark()!)).toMatchObject({ priceLockCode: 'lock-1' })
                unmount()
            }
        })

        // quota, private mode or blocked storage: the guard against a second payout cannot hold
        it('signs and sends nothing where this browser cannot keep the mark', async () => {
            mockInit.mockResolvedValue(transferInit())
            const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new DOMException('quota', 'QuotaExceededError')
            })
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })
            setItem.mockRestore()

            expect(mockSignSpend).not.toHaveBeenCalled()
            expect(mockSubmitTransfer).not.toHaveBeenCalled()
            expect(result.current.phase).toBe('idle')
            expect(result.current.error).toBe('withdraw.errors.noRecord')
        })

        it('sends nothing when the mark fails to hold after the signature', async () => {
            mockInit.mockResolvedValue(transferInit())
            // the probe before the signature passes; the mark itself does not stick
            mockSignSpend.mockImplementation(async () => {
                jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                    throw new DOMException('quota', 'QuotaExceededError')
                })
                return artifact
            })
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })
            jest.restoreAllMocks()

            expect(mockSubmitTransfer).not.toHaveBeenCalled()
            expect(result.current.phase).toBe('idle')
            expect(result.current.error).toBe('withdraw.errors.noRecord')
        })

        it('signs nothing once the lock has expired, and lets Confirm open a new one', async () => {
            mockInit.mockResolvedValue(transferInit({ quoteExpiresAt: new Date(Date.now() - 1000).toISOString() }))
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })

            expect(mockSignSpend).not.toHaveBeenCalled()
            expect(result.current.phase).toBe('idle')
            expect(result.current.error).toBe('withdraw.errors.quoteExpired')
        })

        it('reads a submit that could not name its withdrawal as sent, and still tells the flow', async () => {
            mockInit.mockResolvedValue(transferInit())
            mockSignSpend.mockResolvedValue(artifact)
            mockSubmitTransfer.mockResolvedValue({ provider: 'manteca', intentId: null, status: 'PROCESSING' })
            const onOpened = jest.fn()
            const { result } = renderHook(() => usePixWithdrawSubmit({ onOpened }), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })

            expect(result.current.phase).toBe('funded')
            expect(onOpened).toHaveBeenCalledWith(null)
            // unnamed: the mark stays until the history row shows it
            expect(pendingMark()).not.toBeNull()
        })
    })
})
