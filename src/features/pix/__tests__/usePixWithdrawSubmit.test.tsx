/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { decodeFunctionData, erc20Abi, parseAbi } from 'viem'
import { ApiError } from '@/services/api-error'
import { BALANCE_DECREASE, SEND_MONEY } from '@/constants/query.consts'

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const BRIDGE = '0x10417734001162Ea139e8b044DFe28DbB8B28ad0'
const MINED = `0x${'ab'.repeat(32)}`

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

const DEPOSIT_ABI = parseAbi(['function depositWithId(address tokenAddress, uint256 amount, uint256 commitmentId)'])
const REQUEST = { pixKey: '09579927189', amountBrl: '503' }
const display = {
    amountBrl: '503.00',
    pixKey: '09579927189',
    ownAccount: true as const,
    holderName: 'Ana Souza',
    bankName: 'Banco Inter',
    withdrawUsd: '92.504310',
    rate: '5.445692',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia' as const,
}
const inAMinute = () => new Date(Date.now() + 60_000).toISOString()
const units = (usd: string) => {
    const [whole, fraction = ''] = usd.split('.')
    return BigInt(whole + fraction.padEnd(6, '0').slice(0, 6)).toString()
}
const initResponse = (overrides: Record<string, unknown> = {}, opened: Partial<typeof display> = {}) => ({
    provider: 'avenia',
    intentId: 'w1',
    display: { ...display, ...opened },
    sign: {
        kind: 'deposit-with-id',
        contractAddress: BRIDGE,
        tokenAddress: USDC,
        payAmount: opened.withdrawUsd ?? display.withdrawUsd,
        payAmountUnits: units(opened.withdrawUsd ?? display.withdrawUsd),
        commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
        quoteExpiresAt: inAMinute(),
        ticketExpiresAt: '2026-11-04T12:10:00.000Z',
        ...overrides,
    },
})

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

    it("opens the ticket, signs Rhino's deposit for exactly the pay amount and reports the mined hash", async () => {
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
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
        expect(result.current.phase).toBe('funded')
        expect(result.current.opened).toEqual({ intentId: 'w1', display })
    })

    it('hands the opened id to the flow before anything is signed', async () => {
        mockInit.mockResolvedValue(initResponse())
        const order: string[] = []
        mockSendTransactions.mockImplementation(async () => {
            order.push('sign')
            return { receipt: { status: 'success', transactionHash: MINED, logs: [] } }
        })
        const onOpened = jest.fn((id: string | null) => order.push(`opened ${id}`))
        const { result } = renderHook(() => usePixWithdrawSubmit({ onOpened }), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(order).toEqual(['opened w1', 'sign'])
    })

    it('signs as a balance-decreasing send, so the pending guard sees it', async () => {
        mockInit.mockResolvedValue(initResponse())
        let seen = 0
        mockSendTransactions.mockImplementation(async () => {
            seen = queryClient.isMutating({ mutationKey: [BALANCE_DECREASE] })
            return { receipt: { status: 'success', transactionHash: MINED, logs: [] } }
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
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockRejectedValue(new Error('bundler said no'))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(mockCaptureTriaged).toHaveBeenCalledWith(expect.any(Error), {
            tags: { critical_flow: 'withdraw-pix', withdraw_step: 'sign' },
            extra: { intentId: 'w1' },
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

    it('never calls a send with no receipt a success, and reports nothing it cannot prove', async () => {
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockResolvedValue({ receipt: null })
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(result.current.phase).toBe('unconfirmed')
        expect(mockReportFunding).not.toHaveBeenCalled()
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

    it('never signs again once the ticket is open, even when the signature failed', async () => {
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockRejectedValue(new Error('passkey cancelled'))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(result.current.error).toBe('friendly: passkey cancelled')
        expect(result.current.lockedAfterInit).toBe(true)

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(mockInit).toHaveBeenCalledTimes(1)
        expect(mockSendTransactions).toHaveBeenCalledTimes(1)
    })

    it('refuses to approve a token that is not the wallet USDC', async () => {
        mockInit.mockResolvedValue(initResponse({ tokenAddress: '0x0000000000000000000000000000000000000bad' }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(mockSendTransactions).not.toHaveBeenCalled()
        expect(result.current.error).toBe('unavailable')
    })

    it('treats a reverted deposit as a failure, not a sent withdrawal', async () => {
        mockInit.mockResolvedValue(initResponse())
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'reverted', transactionHash: MINED, logs: [] } })
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(result.current.phase).toBe('opened')
        expect(result.current.lockedAfterInit).toBe(true)
        expect(mockReportFunding).not.toHaveBeenCalled()
    })

    it('signs nothing when the opened quote takes more USD than the review showed, until confirmed again', async () => {
        mockInit.mockResolvedValue(initResponse({}, { withdrawUsd: '93.100000' }))
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        expect(result.current.phase).toBe('reconfirm')
        expect(result.current.opened?.display.withdrawUsd).toBe('93.100000')
        expect(mockSendTransactions).not.toHaveBeenCalled()

        await act(async () => {
            await result.current.confirmOpened()
        })
        expect(mockSendTransactions).toHaveBeenCalledTimes(1)
        expect(mockSendTransactions.mock.calls[0][1]).toMatchObject({ requiredUsdcAmount: 93_100_000n })
        expect(mockInit).toHaveBeenCalledTimes(1)
        expect(result.current.phase).toBe('funded')
    })

    it('asks again when the opened quote pays fewer reais, and signs at once when it is better', async () => {
        mockInit.mockResolvedValueOnce(initResponse({}, { amountBrl: '502.10' }))
        const first = renderHook(() => usePixWithdrawSubmit(), { wrapper })
        await act(async () => {
            await first.result.current.submit(REQUEST, display)
        })
        expect(first.result.current.phase).toBe('reconfirm')

        mockInit.mockResolvedValueOnce(initResponse({}, { withdrawUsd: '92.400000', amountBrl: '503.00' }))
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const second = renderHook(() => usePixWithdrawSubmit(), { wrapper })
        await act(async () => {
            await second.result.current.submit(REQUEST, display)
        })
        expect(second.result.current.phase).toBe('funded')
    })

    it("refuses to sign once Rhino's quote has expired", async () => {
        mockInit.mockResolvedValue(
            initResponse({ quoteExpiresAt: new Date(Date.now() - 1000).toISOString() }, { withdrawUsd: '93.1' })
        )
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })
        await act(async () => {
            await result.current.confirmOpened()
        })

        expect(mockSendTransactions).not.toHaveBeenCalled()
        expect(result.current.error).toBe('withdraw.errors.quoteExpired')
        expect(result.current.lockedAfterInit).toBe(true)
    })

    it('signs nothing when the sign request asks for another amount than the opened quote shows', async () => {
        mockInit.mockResolvedValue(initResponse({ payAmount: '95', payAmountUnits: '95000000' }))
        const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

        await act(async () => {
            await result.current.submit(REQUEST, display)
        })

        expect(mockSendTransactions).not.toHaveBeenCalled()
        expect(result.current.error).toBe('unavailable')
        expect(result.current.lockedAfterInit).toBe(true)
    })

    describe('a signature that failed after the ticket opened', () => {
        const dismissed = () => Object.assign(new Error('The operation was not allowed.'), { name: 'NotAllowedError' })
        const sentMark = () => window.localStorage.getItem('pix-withdraw-sent:w1')
        beforeEach(() => window.localStorage.clear())

        it('may be signed once more after a dismissed passkey, while the quote holds', async () => {
            mockInit.mockResolvedValue(initResponse())
            mockSendTransactions
                .mockRejectedValueOnce(dismissed())
                .mockResolvedValueOnce({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })
            expect(result.current.canSignOpened).toBe(true)
            // nothing went out, so a reload may say so
            expect(sentMark()).toBeNull()

            await act(async () => {
                await result.current.confirmOpened()
            })
            expect(mockSendTransactions).toHaveBeenCalledTimes(2)
            expect(mockInit).toHaveBeenCalledTimes(1)
            expect(result.current.phase).toBe('funded')
            expect(sentMark()).toBe('1')
        })

        it('may be signed once more after a revert, and only once', async () => {
            mockInit.mockResolvedValue(initResponse())
            mockSendTransactions.mockResolvedValue({
                receipt: { status: 'reverted', transactionHash: MINED, logs: [] },
            })
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })
            expect(result.current.canSignOpened).toBe(true)
            await act(async () => {
                await result.current.confirmOpened()
            })
            expect(result.current.canSignOpened).toBe(false)
            await act(async () => {
                await result.current.confirmOpened()
            })
            expect(mockSendTransactions).toHaveBeenCalledTimes(2)
        })

        it('is never signed again after a failure that may have sent the deposit', async () => {
            mockInit.mockResolvedValue(initResponse())
            mockSendTransactions.mockRejectedValue(new Error('bundler said no'))
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })
            await act(async () => {
                await result.current.confirmOpened()
            })

            expect(result.current.canSignOpened).toBe(false)
            expect(mockSendTransactions).toHaveBeenCalledTimes(1)
            // a reload keeps it unconfirmed, not "start again"
            expect(sentMark()).toBe('1')
        })

        it('is not signed again once the quote has expired', async () => {
            mockInit.mockResolvedValue(initResponse({ quoteExpiresAt: new Date(Date.now() + 50).toISOString() }))
            mockSendTransactions.mockImplementationOnce(async () => {
                await new Promise((resolve) => setTimeout(resolve, 60))
                throw dismissed()
            })
            const { result } = renderHook(() => usePixWithdrawSubmit(), { wrapper })

            await act(async () => {
                await result.current.submit(REQUEST, display)
            })
            await act(async () => {
                await result.current.confirmOpened()
            })

            expect(mockSendTransactions).toHaveBeenCalledTimes(1)
            expect(result.current.error).toBe('withdraw.errors.quoteExpired')
            expect(result.current.canSignOpened).toBe(false)
        })
    })

    // Manteca's kind: nothing is open until the API takes the signed transfer, opens the order and broadcasts
    describe('a transfer-then-submit withdrawal', () => {
        const DEPOSIT_ADDRESS = '0x00000000000000000000000000000000000000d3'
        const dismissed = () => Object.assign(new Error('The operation was not allowed.'), { name: 'NotAllowedError' })
        const transferInit = (overrides: Record<string, unknown> = {}) => ({
            provider: 'manteca',
            intentId: null,
            display: { ...display, fixedFeeBrl: '0', provider: 'Manteca' },
            sign: {
                kind: 'transfer-then-submit',
                depositAddress: DEPOSIT_ADDRESS,
                tokenAddress: USDC,
                payAmount: display.withdrawUsd,
                payAmountUnits: units(display.withdrawUsd),
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

        const pendingMark = () => window.localStorage.getItem('pix-withdraw-pending')
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
                expect(JSON.parse(pendingMark()!)).toMatchObject({ userId: 'u1', priceLockCode: 'lock-1' })
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
