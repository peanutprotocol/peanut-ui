/** @jest-environment jsdom */
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { CapabilityRoute } from '@/types/capabilities'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: jest.fn() }) }))
jest.mock('@/hooks/useCurrency', () => ({ useCurrency: () => ({ code: 'BRL', price: { sell: 5.4, buy: 5.5 } }) }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/AddMoney/components/InputAmountStep', () => ({
    __esModule: true,
    default: ({ onSubmit, setCurrencyAmount }: { onSubmit: () => void; setCurrencyAmount: (v: string) => void }) => (
        <div data-testid="amount-step">
            <button onClick={() => setCurrencyAmount('100')}>type</button>
            <button onClick={onSubmit}>submit</button>
        </div>
    ),
}))
jest.mock('@/features/avenia/components/AveniaPixQrDeposit', () => ({
    AveniaPixQrDeposit: ({ intentId, deposit }: { intentId: string; deposit?: { brCode: string } }) => (
        <div data-testid="code-step">
            {intentId} {deposit ? deposit.brCode : 'no code'}
        </div>
    ),
}))
const mockCreate = jest.fn()
jest.mock('@/services/avenia', () => ({
    aveniaApi: {
        depositEligibility: () => Promise.resolve({ minAmountBrl: '20', blockedBanks: [] }),
        createDeposit: (amountBrl: string) => mockCreate(amountBrl),
    },
}))

import { AveniaAddMoneyFlow } from '../components/AveniaAddMoneyFlow'

const route: CapabilityRoute = {
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
}
const renderAt = (searchParams: string, onUrlUpdate?: (event: UrlUpdateEvent) => void) =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                <AveniaAddMoneyFlow route={route} />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )

describe('AveniaAddMoneyFlow and the URL', () => {
    beforeEach(() => jest.clearAllMocks())

    it('after a reload on the code step, shows that deposit instead of a new amount form', () => {
        renderAt('?step=showQR&amount=100&currency=BRL&intentId=d1')
        expect(screen.getByTestId('code-step')).toHaveTextContent('d1 no code')
        expect(screen.queryByTestId('amount-step')).toBeNull()
    })

    it('a code step without a deposit id goes back to the amount', async () => {
        renderAt('?step=showQR&amount=100&currency=BRL')
        expect(await screen.findByTestId('amount-step')).toBeInTheDocument()
    })

    it("writes the new deposit's id to the URL with the code step", async () => {
        mockCreate.mockResolvedValue({
            intentId: 'd2',
            brCode: 'code-d2',
            amountBrl: '100.00',
            usdcAmount: '17.94',
            expiresAt: null,
            payerCpfMasked: '095.***.***-89',
        })
        const urls: string[] = []
        renderAt('', (event) => urls.push(event.queryString))

        fireEvent.click(screen.getByText('type'))
        fireEvent.click(screen.getByText('submit'))

        expect(await screen.findByTestId('code-step')).toHaveTextContent('d2 code-d2')
        await waitFor(() => expect(urls.some((url) => url.includes('intentId=d2'))).toBe(true))
        expect(mockCreate).toHaveBeenCalledWith('100')
    })
})
