/** @jest-environment jsdom */
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { CapabilityRoute } from '@/types/capabilities'
import { pixDepositQueryKey } from '../pixDepositCode'
import { ApiError } from '@/services/api-error'
import en from '@/i18n/app/messages/en.json'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser }) }))
let mockRateAndFee: { exchangeRate: number; providerFeeBrl: string } | null | undefined = null
let mockQuotesTypedAmount = false
jest.mock('@/features/pix/usePixQuoteCurrency', () => ({
    usePixQuoteCurrency: () => ({
        code: 'BRL',
        price: { sell: 5.4, buy: 5.5 },
        rateAndFee: mockRateAndFee,
        quotesTypedAmount: mockQuotesTypedAmount,
    }),
}))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/AddMoney/components/InputAmountStep', () => ({
    __esModule: true,
    default: ({
        onSubmit,
        setCurrencyAmount,
        validationError,
        error,
        details,
    }: {
        onSubmit: () => void
        setCurrencyAmount: (v: string) => void
        validationError?: string | null
        error?: string | null
        details?: import('react').ReactNode
    }) => (
        <div data-testid="amount-step">
            {details}
            <button onClick={() => setCurrencyAmount('100')}>type</button>
            <button onClick={onSubmit}>submit</button>
            {validationError && <p>{validationError}</p>}
            {error && <p>{error}</p>}
        </div>
    ),
}))
jest.mock('@/features/pix/components/PixQrDeposit', () => ({
    PixQrDeposit: ({ intentId, onNewDeposit }: { intentId: string; onNewDeposit: () => void }) => (
        <div data-testid="code-step">
            {intentId}
            <button onClick={onNewDeposit}>new deposit</button>
        </div>
    ),
}))
const mockCreate = jest.fn()
jest.mock('@/services/pix', () => ({
    pixApi: {
        createDeposit: (amountBrl: string) => mockCreate(amountBrl),
    },
}))

import { PixDepositFlow } from '../components/PixDepositFlow'

const route = (payableDepositIntentId?: string, minAmount = '20'): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    limits: { minAmount, currency: 'BRL' },
    candidates: [{ provider: 'avenia', state: 'ready' }],
    ...(payableDepositIntentId ? { payableDepositIntentId } : {}),
})

const renderAt = (
    searchParams: string,
    {
        payable,
        minAmount,
        onUrlUpdate,
    }: { payable?: string; minAmount?: string; onUrlUpdate?: (event: UrlUpdateEvent) => void } = {}
) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = renderWithIntl(
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                <PixDepositFlow route={route(payable, minAmount)} />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    return { ...view, queryClient }
}

describe('PixDepositFlow and the URL', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRateAndFee = null
        mockQuotesTypedAmount = false
    })

    // the amount step shows the quote's rate, the minimum's before an amount, and the fee once the
    // amount on screen is quoted (TASK-24967); never R$5 over the USDC that pays it
    it('shows the minimum quote’s exchangeRate and no fee before an amount, then the fee of the typed amount', () => {
        mockRateAndFee = { exchangeRate: 5.37, providerFeeBrl: '0.95' }
        const view = renderAt('')
        expect(screen.getByText('1 USD = 5.37 BRL')).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        view.unmount()

        mockRateAndFee = { exchangeRate: 5.796567, providerFeeBrl: '0.75' }
        mockQuotesTypedAmount = true
        renderAt('')
        expect(screen.getByText('1 USD = 5.80 BRL')).toBeInTheDocument()
        expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
    })

    it('shows neither row when the quote carries no pair', () => {
        mockRateAndFee = null
        renderAt('')
        expect(screen.getByTestId('amount-step')).toBeInTheDocument()
        expect(screen.queryByText(en.common.exchangeRate)).toBeNull()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
    })

    it('after a reload on the code step, shows that deposit instead of a new amount form', () => {
        renderAt('?step=showQR&amount=100&currency=BRL&intentId=d1')
        expect(screen.getByTestId('code-step')).toHaveTextContent('d1')
        expect(screen.queryByTestId('amount-step')).toBeNull()
    })

    it('a code step without a deposit id goes back to the amount', async () => {
        renderAt('?step=showQR&amount=100&currency=BRL')
        expect(await screen.findByTestId('amount-step')).toBeInTheDocument()
    })

    it('seeds the new deposit for the code screen and writes its id to the URL', async () => {
        const created = {
            provider: 'avenia',
            intentId: 'd2',
            status: 'AWAITING_USER_ACTION',
            codePayable: true,
            pixReceived: false,
            brCode: 'code-d2',
            amountBrl: '100.00',
            usdcAmount: '17.94',
            fixedFeeBrl: '0.75',
            expiresAt: null,
            payerCpfMasked: '111.***.***-35',
        }
        mockCreate.mockResolvedValue(created)
        const urls: string[] = []
        const { queryClient } = renderAt('', { onUrlUpdate: (event) => urls.push(event.queryString) })

        fireEvent.click(screen.getByText('type'))
        fireEvent.click(screen.getByText('submit'))

        expect(await screen.findByTestId('code-step')).toHaveTextContent('d2')
        await waitFor(() => expect(urls.some((url) => url.includes('intentId=d2'))).toBe(true))
        expect(mockCreate).toHaveBeenCalledWith('100')
        expect(queryClient.getQueryData(pixDepositQueryKey('d2'))).toMatchObject({
            brCode: 'code-d2',
            codePayable: true,
        })
    })

    // Aleks, 2026-11-12: Add money never resumes a code. A live one is reached from Activity ("Show code").
    it('starts at the amount step although the route still names a payable code', async () => {
        const urls: string[] = []
        renderAt('', { payable: 'd3', onUrlUpdate: (event) => urls.push(event.queryString) })

        expect(screen.getByTestId('amount-step')).toBeInTheDocument()
        expect(screen.queryByTestId('code-step')).toBeNull()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(urls.some((url) => url.includes('intentId='))).toBe(false)
        expect(mockFetchUser).not.toHaveBeenCalled()
    })

    it('a new deposit from a lapsed code goes to the amount step', async () => {
        renderAt('?step=showQR&intentId=d3', { payable: 'd3' })

        fireEvent.click(screen.getByText('new deposit'))

        // the route may still name the left code payable: it does not open again
        expect(await screen.findByTestId('amount-step')).toBeInTheDocument()
        expect(screen.queryByTestId('code-step')).toBeNull()
    })

    // the route states the provider's minimum: the amount step refuses an amount under it before any quote
    it("says the route's minimum under an amount below it", async () => {
        renderAt('', { minAmount: '200' })
        fireEvent.click(screen.getByText('type'))
        expect(await screen.findByText(/The minimum is R\$200/)).toBeInTheDocument()
    })

    it("shows no minimum line while the amount meets the route's minimum", async () => {
        renderAt('', { minAmount: '1' })
        fireEvent.click(screen.getByText('type'))
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(screen.queryByText(/The minimum is/)).toBeNull()
    })

    it('reads the route again when the provider is paused or dormant (503), and says to try again soon', async () => {
        mockCreate.mockRejectedValue(
            new ApiError('Pix is not available right now.', { status: 503, code: 'PROVIDER_UNAVAILABLE' })
        )
        renderAt('')
        fireEvent.click(screen.getByText('type'))
        fireEvent.click(screen.getByText('submit'))

        await waitFor(() => expect(mockFetchUser).toHaveBeenCalled())
        expect(screen.queryByTestId('code-step')).toBeNull()
    })

    // ruled 2026-11-14: no BRL deposit for a resident of another country; the refusal names support (M5)
    it('a deposit refused for the residence says so and names support, with no "try again"', async () => {
        mockCreate.mockRejectedValue(
            new ApiError('BRL deposits are not available in your country of residence.', {
                status: 422,
                code: 'PIX_RESIDENCE_NOT_SUPPORTED',
            })
        )
        renderAt('')
        fireEvent.click(screen.getByText('type'))
        fireEvent.click(screen.getByText('submit'))

        expect(await screen.findByText(en.pix.residenceNotServed)).toBeInTheDocument()
        expect(en.pix.residenceNotServed).toMatch(/support/i)
        expect(screen.queryByText(en.pix.unavailable)).toBeNull()
    })
})
