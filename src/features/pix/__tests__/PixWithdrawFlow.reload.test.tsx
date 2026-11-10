/** @jest-environment jsdom */
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { UrlUpdateEvent } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute } from '@/types/capabilities'
import { ApiError } from '@/services/api-error'

// general.utils reaches the viem clients, whose RPC-ranking timers keep the worker alive
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/withdraw/manteca',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser }) }))
const mockOpenSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockOpenSupport }),
    useModalsContextOptional: () => null,
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
jest.mock('@/hooks/useSendFlowOrigin', () => ({ useSendFlowOrigin: () => ({ isFromSendFlow: false }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
const QUOTED = {
    code: 'BRL',
    symbol: 'R$',
    price: { sell: 5.4, buy: 5.5 },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
}
const mockQuote = jest.fn((..._args: unknown[]) => QUOTED)
jest.mock('@/features/pix/usePixQuoteCurrency', () => ({
    usePixQuoteCurrency: (...args: unknown[]) => mockQuote(...args),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        spendableBalance: 100_000_000n,
        formattedSpendableBalance: '100',
        spendableBalanceDecimal: 100,
        sendTransactions: jest.fn(),
    }),
}))
const mockPreview = jest.fn()
const mockInit = jest.fn()
const mockSubmitTransfer = jest.fn()
jest.mock('@/services/pix', () => ({
    pixApi: {
        previewWithdrawal: (request: unknown) => mockPreview(request),
        openWithdrawal: (request: unknown) => mockInit(request),
        submitWithdrawal: (request: unknown) => mockSubmitTransfer(request),
    },
}))
const mockEntry = jest.fn()
jest.mock('@/hooks/useHistoryEntry', () => ({ useHistoryEntry: () => mockEntry() }))
// the transfer-then-submit signer: these withdrawals sign a deposit with its id
const mockSignSpend = jest.fn()
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({
    useSignSpendBundle: () => ({ signSpend: (input: unknown) => mockSignSpend(input) }),
}))
jest.mock('@/hooks/wallet/useRainControllerRepair', () => ({ useRainControllerRepair: () => jest.fn() }))
jest.mock('@/hooks/wallet/useSignedSpendRecovery', () => ({ useSignedSpendRecovery: () => jest.fn() }))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: null }) }))

import { PixWithdrawFlow } from '../components/PixWithdrawFlow'

const route: CapabilityRoute = {
    operation: 'withdraw',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
}
const entry = (status: string, intentStatus?: string) => ({
    data: { uuid: 'w1', status, currency: { amount: '503.00', code: 'BRL' }, extraData: { intentStatus } },
    isLoading: false,
})

const renderAt = (searchParams: string, onUrlUpdate?: (event: UrlUpdateEvent) => void) =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                <PixWithdrawFlow route={route} />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )

describe('PixWithdrawFlow after a reload', () => {
    beforeEach(() => jest.clearAllMocks())

    it('shows the opened withdrawal, not the filled review, so a second Confirm is not on screen', () => {
        mockEntry.mockReturnValue(entry('PENDING'))
        renderAt('?step=review&destination=09579927189&destinationAmount=503&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.unconfirmed)).toBeInTheDocument()
        expect(screen.getByText('R$503')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.confirm })).toBeNull()
        expect(mockPreview).not.toHaveBeenCalled()
        expect(mockInit).not.toHaveBeenCalled()
    })

    it('a withdrawal this device never signed reads as not sent, and starts a new one from the key', async () => {
        window.localStorage.clear()
        mockEntry.mockReturnValue(entry('PENDING', 'AWAITING_USER_ACTION'))
        const urls: string[] = []
        renderAt('?step=success&intentId=w1', (event) => urls.push(event.queryString))

        expect(screen.getByText(en.pix.withdraw.notSent)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.tryAgain }))

        await waitFor(() => expect(urls.at(-1)).not.toContain('intentId'))
        // the first step is the key, so the URL is empty again
        expect(await screen.findByText(en.pix.withdraw.keyIntro)).toBeInTheDocument()
        expect(mockInit).not.toHaveBeenCalled()
    })

    it('a withdrawal this device may have signed stays unconfirmed after a reload', () => {
        window.localStorage.setItem('pix-withdraw-sent:w1', '1')
        mockEntry.mockReturnValue(entry('PENDING', 'AWAITING_USER_ACTION'))
        renderAt('?step=success&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.unconfirmed)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.tryAgain })).toBeNull()
        window.localStorage.clear()
    })

    it('reads the outcome from the history entry once Avenia paid the Pix', () => {
        mockEntry.mockReturnValue(entry('COMPLETED'))
        renderAt('?step=success&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.arrived)).toBeInTheDocument()
    })

    it('says nothing left the wallet when the unsigned withdrawal expired', () => {
        mockEntry.mockReturnValue(entry('CANCELLED'))
        renderAt('?step=success&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.notSent)).toBeInTheDocument()
    })

    it('a withdrawal that ended in a way this build does not know sends the user to support', () => {
        mockEntry.mockReturnValue(entry('SOMETHING_NEW'))
        renderAt('?step=success&intentId=w1')

        expect(screen.getByText(en.pix.withdraw.stuck)).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.sent)).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
        expect(mockOpenSupport).toHaveBeenCalledWith(true)
    })

    it('without an opened withdrawal, the success step falls back to the form', () => {
        mockEntry.mockReturnValue(entry('PENDING'))
        renderAt('?step=success&destination=09579927189')

        expect(screen.queryByText(en.pix.withdraw.unconfirmed)).toBeNull()
    })

    it('puts the opened id in the URL at Confirm and keeps the review while the new quote waits', async () => {
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
        mockPreview.mockResolvedValue(display)
        // the opened quote takes more USD: nothing is signed until the user confirms again
        mockInit.mockResolvedValue({
            intentId: 'w2',
            display: { ...display, withdrawUsd: '93.100000' },
            sign: {
                kind: 'deposit-with-id',
                contractAddress: '0x10417734001162Ea139e8b044DFe28DbB8B28ad0',
                tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                payAmount: '93.100000',
                payAmountUnits: '93100000',
                commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
                quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
                ticketExpiresAt: new Date(Date.now() + 600_000).toISOString(),
            },
        })
        const urls: string[] = []
        renderAt('?step=review&destination=09579927189&destinationAmount=503', (event) => urls.push(event.queryString))

        fireEvent.click(await screen.findByRole('button', { name: en.common.confirm }))

        expect(await screen.findByText(en.pix.withdraw.quoteMoved)).toBeInTheDocument()
        await waitFor(() => expect(urls.some((url) => url.includes('intentId=w2'))).toBe(true))
        // from the open ticket on, the URL holds the step and the id only; the review stays
        const opened = new URLSearchParams(urls.at(-1))
        expect([...opened.keys()].sort()).toEqual(['intentId', 'step'])
        expect(screen.getByRole('button', { name: en.common.confirm })).toBeEnabled()
        expect(screen.queryByText(en.pix.withdraw.unconfirmed)).toBeNull()
    })

    // the other sign kind: nothing opens until the API takes the signed transfer, and its answer names the withdrawal
    it('opens a transfer-then-submit withdrawal at its submit, then drops the form and shows it on its way', async () => {
        const display = {
            amountBrl: '503.00',
            pixKey: '09579927189',
            ownAccount: null,
            holderName: 'Ana Souza',
            bankName: null,
            withdrawUsd: '92.504310',
            rate: '5.437525',
            fixedFeeBrl: '0',
            arrivalEstimateSeconds: 300,
            provider: 'Manteca',
        }
        mockPreview.mockResolvedValue(display)
        mockInit.mockResolvedValue({
            provider: 'manteca',
            intentId: null,
            display,
            sign: {
                kind: 'transfer-then-submit',
                depositAddress: '0x00000000000000000000000000000000000000d3',
                tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                payAmount: '92.504310',
                payAmountUnits: '92504310',
                priceLockCode: 'lock-1',
                quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
        })
        mockSignSpend.mockResolvedValue({
            strategy: 'smart-only',
            signedUserOp: { signedUserOp: { sender: '0xabc' }, chainId: '42161', entryPointAddress: '0xe' },
        })
        mockSubmitTransfer.mockResolvedValue({ provider: 'manteca', intentId: 'm1', status: 'PROCESSING' })
        mockEntry.mockReturnValue({ data: undefined, isLoading: true })
        const urls: string[] = []
        renderAt('?step=review&destination=09579927189&destinationAmount=503', (event) => urls.push(event.queryString))

        fireEvent.click(await screen.findByRole('button', { name: en.common.confirm }))

        expect(
            await screen.findByText(en.pix.withdraw.sentTo.replace('{destination}', 'Ana Souza'))
        ).toBeInTheDocument()
        await waitFor(() => expect(urls.some((url) => url.includes('intentId=m1'))).toBe(true))
        expect([...new URLSearchParams(urls.at(-1)).keys()].sort()).toEqual(['intentId', 'step'])
    })
})

describe('PixWithdrawFlow amount step', () => {
    beforeEach(() => jest.clearAllMocks())
    afterEach(() => mockQuote.mockReturnValue(QUOTED))

    it('quotes only while the amount step is on screen', () => {
        mockPreview.mockReturnValue(new Promise(() => {}))
        const enabledAt = (search: string) => {
            mockQuote.mockClear()
            const view = renderAt(search)
            const enabled = mockQuote.mock.calls.at(-1)?.[3]
            view.unmount()
            return enabled
        }
        expect(enabledAt('?step=amount&destination=09579927189')).toBe(true)
        expect(enabledAt('?step=review&destination=09579927189&destinationAmount=503')).toBe(false)
        expect(enabledAt('?step=pix-key')).toBe(false)
    })

    it('shows reais with the R$ symbol, as the deposit amount and the review do', () => {
        renderAt('?step=amount&destination=09579927189')
        expect(screen.getByText('R$')).toBeInTheDocument()
        expect(screen.queryByText('BRL')).toBeNull()
    })

    it('offers a retry, not a spinner, when the quote fails', () => {
        const refetch = jest.fn()
        mockQuote.mockReturnValue({ ...QUOTED, price: null, isError: true, refetch } as never)
        renderAt('?step=amount&destination=09579927189')

        expect(screen.getByText(en.errors.rateUnavailable)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.continue })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: en.common.retry }))
        expect(refetch).toHaveBeenCalledTimes(1)
    })
})

describe('PixWithdrawFlow refused preview', () => {
    beforeEach(() => jest.clearAllMocks())
    const refuse = (status: number, code: string) =>
        mockPreview.mockRejectedValue(new ApiError('refused', { status, code }))
    const REVIEW = '?step=review&destination=09579927189&destinationAmount=503'

    it('over the monthly limit: Change amount goes back to the amount step and keeps the key', async () => {
        refuse(422, 'PIX_LIMIT_EXCEEDED')
        const urls: string[] = []
        renderAt(REVIEW, (event) => urls.push(event.queryString))

        fireEvent.click(await screen.findByRole('button', { name: en.pix.withdraw.changeAmount }))

        await waitFor(() => expect(urls.at(-1)).toContain('step=amount'))
        expect(urls.at(-1)).toContain('destination=09579927189')
        expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
    })

    // a paused or dormant provider answers 503: the route may say so now, so the capabilities are read again
    it('a paused provider: Retry, and the route read again', async () => {
        refuse(503, 'PROVIDER_UNAVAILABLE')
        renderAt(REVIEW)

        expect(await screen.findByText(en.pix.unavailable)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.retry })).toBeInTheDocument()
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalled())
    })

    it('withdrawals still on their way: no retry, the message says to try later, Cancel only', async () => {
        refuse(409, 'WITHDRAWAL_IN_PROGRESS')
        renderAt(REVIEW)

        expect(await screen.findByText(en.pix.withdraw.errors.inProgress)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
        expect(screen.queryByRole('button', { name: en.pix.withdraw.changeAmount })).toBeNull()
        expect(screen.getByRole('button', { name: en.common.cancel })).toBeInTheDocument()
    })

    it('under the minimum: Change amount goes back to the amount step', async () => {
        refuse(422, 'PIX_MIN_AMOUNT')
        const urls: string[] = []
        renderAt(REVIEW, (event) => urls.push(event.queryString))

        fireEvent.click(await screen.findByRole('button', { name: en.pix.withdraw.changeAmount }))

        await waitFor(() => expect(urls.at(-1)).toContain('step=amount'))
        expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
    })

    it.each(['PIX_KEY_NOT_OWN', 'PIX_KEY_BLOCKED', 'PIX_KEY_NOT_FOUND'])(
        'the key was refused (%s): Change key opens the key step with the key kept to edit',
        async (code) => {
            refuse(422, code)
            const urls: string[] = []
            renderAt(REVIEW, (event) => urls.push(event.queryString))

            fireEvent.click(await screen.findByRole('button', { name: en.pix.withdraw.changeKey }))

            expect(await screen.findByDisplayValue('09579927189')).toBeInTheDocument()
            expect(new URLSearchParams(urls.at(-1)).get('destination')).toBe('09579927189')
            expect(screen.queryByRole('button', { name: en.common.retry })).toBeNull()
        }
    )

    it('the provider rejected the account: no retry and no edit, the message says what to do', async () => {
        refuse(403, 'PROVIDER_REJECTED')
        renderAt(REVIEW)

        expect(await screen.findByText(en.errors.providerRejected)).toBeInTheDocument()
        for (const name of [en.common.retry, en.pix.withdraw.changeAmount, en.pix.withdraw.changeKey]) {
            expect(screen.queryByRole('button', { name })).toBeNull()
        }
    })

    it('the quote changed: Retry asks for the preview again', async () => {
        refuse(409, 'PIX_QUOTE_CHANGED')
        renderAt(REVIEW)

        fireEvent.click(await screen.findByRole('button', { name: en.common.retry }))

        await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2))
    })
})
