/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { decodeFunctionData, parseAbi } from 'viem'
import { ApiError } from '@/services/api-error'

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const BRIDGE = '0x10417734001162Ea139e8b044DFe28DbB8B28ad0'
const MINED = `0x${'ab'.repeat(32)}`

// general.utils reaches the viem clients, whose RPC-ranking timers keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/utils/network-triage', () => ({ captureNetworkTriagedFailure: jest.fn() }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (error: unknown) => `friendly: ${(error as Error).message}`,
}))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser }) }))
const mockSendTransactions = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ sendTransactions: (...args: unknown[]) => mockSendTransactions(...args) }),
}))
const mockPreview = jest.fn()
const mockOpen = jest.fn()
const mockReport = jest.fn()
const mockRead = jest.fn()
jest.mock('@/services/pix', () => ({
    pixApi: {
        previewPayment: (request: unknown) => mockPreview(request),
        openPayment: (request: unknown) => mockOpen(request),
        reportPaymentFunding: (intentId: string, hash: string) => mockReport(intentId, hash),
        readPayment: (intentId: string) => mockRead(intentId),
    },
}))

import posthog from 'posthog-js'
import { usePixPayment } from '../usePixPayment'

const DEPOSIT_ABI = parseAbi(['function depositWithId(address tokenAddress, uint256 amount, uint256 commitmentId)'])
const FIXED_CODE = '000201-fixed'
const OPEN_CODE = '000201-open'
const display = (amountBrl: string, withdrawUsd: string, amountFixed = true) => ({
    amountBrl,
    amountFixed,
    merchantName: 'PADARIA PAO DOURADO LTDA',
    merchantTaxIdMasked: '12.345.678/0001-95',
    bankName: 'Banco Inter S.A.',
    withdrawUsd,
    rate: '5.364547',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia',
})
const FIXED = display('42.50', '8.062211')
const units = (usd: string) => {
    const [whole, fraction = ''] = usd.split('.')
    return BigInt(whole + fraction.padEnd(6, '0').slice(0, 6)).toString()
}
const opened = (shown = FIXED, intentId = 'pay-1') => ({
    provider: 'avenia',
    intentId,
    display: shown,
    sign: {
        kind: 'deposit-with-id',
        contractAddress: BRIDGE,
        tokenAddress: USDC,
        payAmount: shown.withdrawUsd,
        payAmountUnits: units(shown.withdrawUsd),
        commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
        quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        ticketExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    },
})
const refusal = (status: number, body: Record<string, unknown>) =>
    new ApiError(String(body.error ?? 'refused'), {
        status,
        code: body.code as string,
        intentId: body.intentId as string | undefined,
        minimum: body.minAmount ? { amount: body.minAmount as string, currency: 'BRL' } : undefined,
    })

describe('usePixPayment', () => {
    let queryClient: QueryClient
    let urlUpdates: UrlUpdateEvent[]
    const wrapper = ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter hasMemory onUrlUpdate={(event) => urlUpdates.push(event)}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </NuqsTestingAdapter>
    )
    const render = (props: { brCode: string; amountBrl?: string }) =>
        renderHook(
            ({ amountBrl }: { amountBrl?: string }) =>
                usePixPayment({
                    brCode: props.brCode,
                    timestamp: '1',
                    enabled: true,
                    canStart: true,
                    amountBrl,
                    minimumBrl: '5',
                }),
            { wrapper, initialProps: { amountBrl: props.amountBrl } }
        )

    const urlIntentId = () => urlUpdates.at(-1)?.searchParams.get('intentId') ?? null

    beforeEach(() => {
        jest.clearAllMocks()
        sessionStorage.clear()
        localStorage.clear()
        urlUpdates = []
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        mockReport.mockResolvedValue({ status: 'PROCESSING' })
        mockRead.mockResolvedValue({ provider: 'avenia', intentId: 'pay-1', state: 'processing', status: 'PROCESSING' })
    })

    it("a code with its own amount: reviews it, opens it for the review's spend, signs one bridge and reports it", async () => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockResolvedValue(opened())
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const { result } = render({ brCode: FIXED_CODE })

        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))
        expect(mockPreview).toHaveBeenCalledWith({ brCode: FIXED_CODE })
        expect(result.current.amountFixed).toBe(true)

        await act(async () => {
            await result.current.pay()
        })

        // no amount for a code that has one; the review's USDC is the ceiling
        const request = mockOpen.mock.calls[0][0]
        expect(request).toEqual({
            brCode: FIXED_CODE,
            maxSpendUsd: '8.062211',
            idempotencyKey: expect.stringMatching(/^[0-9a-f]{32}$/),
        })
        const [calls, options] = mockSendTransactions.mock.calls[0]
        expect(options).toMatchObject({ chainId: '42161', requiredUsdcAmount: 8_062_211n, kind: 'QR_PAY' })
        expect(decodeFunctionData({ abi: DEPOSIT_ABI, data: calls[1].data }).args).toEqual([
            USDC,
            8_062_211n,
            BigInt('0x6aeb17ea29f84d1e9b0c3a5d7e2f1c08'),
        ])
        expect(mockReport).toHaveBeenCalledWith('pay-1', MINED)
        // the URL names the payment, so a reload reads it instead of offering Pay again
        await waitFor(() => expect(urlIntentId()).toBe('pay-1'))
        await waitFor(() => expect(result.current.outcome).toBe('processing'))

        mockRead.mockResolvedValue({ provider: 'avenia', intentId: 'pay-1', state: 'paid', status: 'COMPLETED' })
        await act(async () => {
            await queryClient.invalidateQueries({ queryKey: ['pix-pay'] })
        })
        await waitFor(() => expect(result.current.outcome).toBe('paid'))
    })

    it('a code without an amount: no call under the route minimum, then a review of the reais typed', async () => {
        mockPreview.mockImplementation(async (request: { amountBrl?: string }) => {
            if (!request.amountBrl) throw refusal(400, { code: 'PAYMENT_DESTINATION_MISSING_AMOUNT' })
            return display(request.amountBrl, '9.460000', false)
        })
        const { result, rerender } = render({ brCode: OPEN_CODE })
        await waitFor(() => expect(result.current.amountFixed).toBe(false))
        expect(result.current.codeRefusal).toBeNull()

        rerender({ amountBrl: '4' })
        await new Promise((resolve) => setTimeout(resolve, 700))
        await act(async () => {
            await result.current.pay()
        })
        expect(mockPreview).toHaveBeenCalledTimes(1)
        expect(mockOpen).not.toHaveBeenCalled()
        expect(mockSendTransactions).not.toHaveBeenCalled()

        rerender({ amountBrl: '50' })
        await waitFor(() => expect(result.current.reviewed?.amountBrl).toBe('50'), { timeout: 2_000 })
        expect(mockPreview).toHaveBeenLastCalledWith({ brCode: OPEN_CODE, amountBrl: '50' })
    })

    it('a code whose own amount is under the route minimum is reviewed, and Pay calls nothing', async () => {
        mockPreview.mockResolvedValue(display('3.00', '0.699000'))
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed?.amountBrl).toBe('3.00'))
        await act(async () => {
            await result.current.pay()
        })
        expect(mockOpen).not.toHaveBeenCalled()
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    it('a payment already past its signature is read, never signed again', async () => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockRejectedValue(refusal(409, { code: 'PIX_PAYMENT_EXISTS', intentId: 'pay-0' }))
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).not.toBeNull())

        await act(async () => {
            await result.current.pay()
        })

        expect(mockSendTransactions).not.toHaveBeenCalled()
        await waitFor(() => expect(urlIntentId()).toBe('pay-0'))
        await waitFor(() => expect(mockRead).toHaveBeenCalledWith('pay-0'))
        expect(result.current.outcome).toBe('processing')
    })

    // review 2, finding 2: two tabs of one scan share its key, so the API hands both the same sign
    it('a payment whose deposit this device may have sent is read, never signed again', async () => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockResolvedValue(opened())
        localStorage.setItem('pix-withdraw-sent:pay-1', '1')
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))

        await act(async () => {
            await result.current.pay()
        })

        expect(mockOpen).toHaveBeenCalledTimes(1)
        expect(mockSendTransactions).not.toHaveBeenCalled()
        await waitFor(() => expect(urlIntentId()).toBe('pay-1'))
        await waitFor(() => expect(mockRead).toHaveBeenCalledWith('pay-1'))
        await waitFor(() => expect(result.current.outcome).toBe('processing'))
    })

    it('a dismissed passkey sends nothing: the form stays, and the next tap opens the same payment again', async () => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockResolvedValue(opened())
        const cancelled = new Error('The operation either timed out or was not allowed.')
        cancelled.name = 'NotAllowedError'
        mockSendTransactions.mockRejectedValueOnce(cancelled)
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).not.toBeNull())

        await act(async () => {
            await result.current.pay()
        })
        expect(result.current.phase).toBe('idle')
        expect(result.current.error).toBe('errors.confirmTransaction')
        await waitFor(() => expect(urlIntentId()).toBeNull())

        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        await act(async () => {
            await result.current.pay()
        })
        // one key per scan and amount: the retry answers the same payment
        expect(mockOpen.mock.calls[1][0].idempotencyKey).toBe(mockOpen.mock.calls[0][0].idempotencyKey)
        expect(mockReport).toHaveBeenCalledWith('pay-1', MINED)
    })

    it('an open whose spend moved against the user is held unsigned; the next tap signs that same payment', async () => {
        mockPreview.mockResolvedValue(FIXED)
        const moved = display('42.50', '8.090000')
        mockOpen.mockResolvedValue(opened(moved))
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).not.toBeNull())

        await act(async () => {
            await result.current.pay()
        })
        expect(mockSendTransactions).not.toHaveBeenCalled()
        expect(result.current.notice).toBe('reviewUpdatedQuote')
        expect(result.current.reviewed?.withdrawUsd).toBe('8.090000')

        await act(async () => {
            await result.current.pay()
        })
        expect(mockOpen).toHaveBeenCalledTimes(1)
        expect(mockSendTransactions.mock.calls[0][1]).toMatchObject({ requiredUsdcAmount: 8_090_000n })
    })

    // API-CONTRACT-M5 §2: a re-quote at the open would pay other reais than the user entered
    it('a quote that changed at the open shows the amount-changed line and reviews the code again', async () => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockRejectedValue(refusal(409, { code: 'PIX_QUOTE_CHANGED' }))
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))

        await act(async () => {
            await result.current.pay()
        })

        expect(result.current.error).toBe('withdraw.errors.quoteChanged')
        expect(result.current.phase).toBe('idle')
        await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2))
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    // review 2, finding 4: the API ends the payment it recorded under a key it refused
    it.each([
        ['PIX_QUOTE_CHANGED', refusal(409, { code: 'PIX_QUOTE_CHANGED' })],
        ['PIX_LIMIT_EXCEEDED', refusal(422, { code: 'PIX_LIMIT_EXCEEDED' })],
        ['PROVIDER_UNAVAILABLE (502)', refusal(502, { code: 'PROVIDER_UNAVAILABLE' })],
        ['a 400 without a code', refusal(400, {})],
    ])('an open the API refused (%s): the next Pay opens with a new key', async (_label, refused) => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockRejectedValueOnce(refused).mockResolvedValueOnce(opened())
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))

        await act(async () => {
            await result.current.pay()
        })
        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))
        await act(async () => {
            await result.current.pay()
        })

        expect(mockOpen).toHaveBeenCalledTimes(2)
        expect(mockOpen.mock.calls[1][0].idempotencyKey).not.toBe(mockOpen.mock.calls[0][0].idempotencyKey)
    })

    it.each([
        ['no answer (offline)', new TypeError('Failed to fetch')],
        ['a 504 the API did not name', refusal(504, {})],
    ])('an open with %s may have opened a payment: the next Pay asks with the same key', async (_label, lost) => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockRejectedValueOnce(lost).mockResolvedValueOnce(opened())
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))

        await act(async () => {
            await result.current.pay()
        })
        await act(async () => {
            await result.current.pay()
        })

        expect(mockOpen.mock.calls[1][0].idempotencyKey).toBe(mockOpen.mock.calls[0][0].idempotencyKey)
    })

    // API review 2 (6575b4dd8): a same-key retry after a payment that ended with nothing paid
    it('nothing was paid (PIX_QUOTE_EXPIRED at the open): the scan-again line, and the next Pay opens with a new key', async () => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockRejectedValueOnce(refusal(409, { code: 'PIX_QUOTE_EXPIRED' })).mockResolvedValueOnce(opened())
        mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))

        await act(async () => {
            await result.current.pay()
        })
        expect(result.current.error).toBe('errors.restartScan')
        expect(urlIntentId()).toBeNull()

        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))
        await act(async () => {
            await result.current.pay()
        })
        expect(mockOpen.mock.calls[1][0].idempotencyKey).not.toBe(mockOpen.mock.calls[0][0].idempotencyKey)
    })

    it('a lapsed payment the same key opened (PIX_PAYMENT_EXISTS) is read, not paid again', async () => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockRejectedValue(refusal(409, { code: 'PIX_PAYMENT_EXISTS', intentId: 'pay-lapsed' }))
        mockRead.mockResolvedValue({
            provider: 'avenia',
            intentId: 'pay-lapsed',
            state: 'cancelled',
            status: 'CANCELLED',
            perk: null,
        })
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))

        await act(async () => {
            await result.current.pay()
        })
        await waitFor(() => expect(result.current.outcome).toBe('cancelled'))
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    // API review 2 (dc2b6bc50): a second scan of a fixed-amount code while the first attempt holds its USDC
    it('an amount another payment still holds says so in QR words, not the withdrawal line', async () => {
        mockPreview.mockResolvedValue(FIXED)
        mockOpen.mockRejectedValue(refusal(409, { code: 'WITHDRAWAL_IN_PROGRESS' }))
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))

        await act(async () => {
            await result.current.pay()
        })
        expect(result.current.error).toBe('errors.amountHeld')
        expect(mockSendTransactions).not.toHaveBeenCalled()
    })

    it('a refused review of the code is the scan refusal, in the QR copy', async () => {
        mockPreview.mockRejectedValue(refusal(422, { code: 'PIX_KEY_BLOCKED' }))
        const { result } = render({ brCode: FIXED_CODE })
        await waitFor(() => expect(result.current.codeRefusal).toBe('errors.merchantNotAvailable'))
        await act(async () => {
            await result.current.pay()
        })
        expect(mockOpen).not.toHaveBeenCalled()
    })

    describe('the same QR analytics as Manteca, with the route’s provider (TASK-24947 M5)', () => {
        const captured = (event: string) =>
            (posthog.capture as jest.Mock).mock.calls.filter(([name]) => name === event).map(([, props]) => props)

        it('reports each stage of an attempt under qr_payment_stage, provider avenia, ending with the paid read', async () => {
            mockPreview.mockResolvedValue(FIXED)
            mockOpen.mockResolvedValue(opened())
            mockSendTransactions.mockResolvedValue({ receipt: { status: 'success', transactionHash: MINED, logs: [] } })
            mockRead.mockResolvedValue({
                provider: 'avenia',
                intentId: 'pay-1',
                state: 'paid',
                status: 'COMPLETED',
                perk: null,
            })
            const { result } = renderHook(
                () =>
                    usePixPayment({
                        brCode: FIXED_CODE,
                        timestamp: '1',
                        enabled: true,
                        canStart: true,
                        amountBrl: undefined,
                        minimumBrl: '5',
                        provider: 'avenia',
                    }),
                { wrapper }
            )
            await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))
            expect(captured('pix_qr_init_result')).toEqual([
                expect.objectContaining({ outcome: 'ready', provider: 'avenia' }),
            ])

            await act(async () => {
                await result.current.pay()
            })
            await waitFor(() => expect(result.current.outcome).toBe('paid'))

            const stages = captured('qr_payment_stage')
            expect(stages.every((props) => props.provider === 'avenia' && props.qr_type === 'PIX')).toBe(true)
            expect(stages.map((props) => props.stage)).toEqual([
                'pay_clicked',
                'lock_ready',
                'signature_ready',
                'request_sent',
                'response_received',
                'success_committed',
                'attempt_finished',
            ])
            expect(stages.at(-1)).toMatchObject({ outcome: 'success' })
            expect(new Set(stages.map((props) => props.client_payment_attempt_id)).size).toBe(1)
        })

        it('a refused open finishes the attempt as failed, naming the refusal', async () => {
            mockPreview.mockResolvedValue(FIXED)
            mockOpen.mockRejectedValue(refusal(422, { code: 'PIX_LIMIT_EXCEEDED' }))
            const { result } = renderHook(
                () =>
                    usePixPayment({
                        brCode: FIXED_CODE,
                        timestamp: '1',
                        enabled: true,
                        canStart: true,
                        amountBrl: undefined,
                        minimumBrl: '5',
                        provider: 'avenia',
                    }),
                { wrapper }
            )
            await waitFor(() => expect(result.current.reviewed).toEqual(FIXED))
            await act(async () => {
                await result.current.pay()
            })
            const stages = captured('qr_payment_stage')
            expect(stages.map((props) => [props.stage, props.outcome, props.failure_code])).toEqual([
                ['pay_clicked', undefined, undefined],
                ['lock_ready', 'failed', 'PIX_LIMIT_EXCEEDED'],
                ['attempt_finished', 'failed', undefined],
            ])
        })
    })

    it('reads a paid payment once more when its reward is not issued yet, then stops (API-CONTRACT-M5 §3)', async () => {
        const reopened = ({ children }: { children: ReactNode }) => (
            <NuqsTestingAdapter searchParams="?intentId=pay-1">
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </NuqsTestingAdapter>
        )
        const perk = {
            eligible: true,
            discountPercentage: 0,
            claimed: false,
            sponsoredUsd: 1,
            reason: 'Pix cashback',
            usageId: 'u-1',
            payoutStatus: 'pending',
        }
        mockRead
            .mockResolvedValueOnce({
                provider: 'avenia',
                intentId: 'pay-1',
                state: 'paid',
                status: 'COMPLETED',
                perk: null,
            })
            .mockResolvedValue({ provider: 'avenia', intentId: 'pay-1', state: 'paid', status: 'COMPLETED', perk })
        const { result } = renderHook(
            () =>
                usePixPayment({
                    brCode: FIXED_CODE,
                    timestamp: '1',
                    enabled: true,
                    canStart: true,
                    amountBrl: undefined,
                    minimumBrl: '5',
                }),
            { wrapper: reopened }
        )
        await waitFor(() => expect(result.current.outcome).toBe('paid'))
        expect(result.current.payment?.perk).toBeNull()
        await waitFor(() => expect(result.current.payment?.perk).toEqual(perk), { timeout: 6_000 })
        expect(mockRead).toHaveBeenCalledTimes(2)
    }, 10_000)
})
