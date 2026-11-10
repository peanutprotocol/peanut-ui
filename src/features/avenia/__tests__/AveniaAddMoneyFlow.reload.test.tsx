/** @jest-environment jsdom */
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { CapabilityRoute } from '@/types/capabilities'
import { aveniaDepositQueryKey } from '../aveniaDepositCode'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: mockFetchUser }) }))
jest.mock('@/features/pix/usePixQuoteCurrency', () => ({
    usePixQuoteCurrency: () => ({ code: 'BRL', price: { sell: 5.4, buy: 5.5 } }),
}))
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
    AveniaPixQrDeposit: ({ intentId, onNewDeposit }: { intentId: string; onNewDeposit: () => void }) => (
        <div data-testid="code-step">
            {intentId}
            <button onClick={onNewDeposit}>new deposit</button>
        </div>
    ),
}))
const mockCreate = jest.fn()
jest.mock('@/services/pix', () => ({
    pixApi: {
        depositRules: () => Promise.resolve({ minAmountBrl: '20', blockedBanks: [] }),
        createDeposit: (amountBrl: string) => mockCreate(amountBrl),
    },
}))

import { AveniaAddMoneyFlow } from '../components/AveniaAddMoneyFlow'

const route = (payableDepositIntentId?: string): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
    ...(payableDepositIntentId ? { payableDepositIntentId } : {}),
})

const renderAt = (
    searchParams: string,
    { payable, onUrlUpdate }: { payable?: string; onUrlUpdate?: (event: UrlUpdateEvent) => void } = {}
) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = renderWithIntl(
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                <AveniaAddMoneyFlow route={route(payable)} />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    return { ...view, queryClient }
}

describe('AveniaAddMoneyFlow and the URL', () => {
    beforeEach(() => jest.clearAllMocks())

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
            payerCpfMasked: '095.***.***-89',
        }
        mockCreate.mockResolvedValue(created)
        const urls: string[] = []
        const { queryClient } = renderAt('', { onUrlUpdate: (event) => urls.push(event.queryString) })

        fireEvent.click(screen.getByText('type'))
        fireEvent.click(screen.getByText('submit'))

        expect(await screen.findByTestId('code-step')).toHaveTextContent('d2')
        await waitFor(() => expect(urls.some((url) => url.includes('intentId=d2'))).toBe(true))
        expect(mockCreate).toHaveBeenCalledWith('100')
        expect(queryClient.getQueryData(aveniaDepositQueryKey('d2'))).toMatchObject({
            brCode: 'code-d2',
            codePayable: true,
        })
    })

    it('a re-entry right after a new code opens that code, because the create reads the route again', async () => {
        mockCreate.mockResolvedValue({
            intentId: 'd4',
            brCode: 'code-d4',
            amountBrl: '100.00',
            usdcAmount: '17.94',
            fixedFeeBrl: '0.75',
            expiresAt: null,
            payerCpfMasked: '095.***.***-89',
        })
        // the API names the new code payable to a user read after the create
        let payable: string | undefined
        mockFetchUser.mockImplementationOnce(() => {
            payable = 'd4'
            return Promise.resolve(null)
        })
        const first = renderAt('')
        fireEvent.click(screen.getByText('type'))
        fireEvent.click(screen.getByText('submit'))
        expect(await screen.findByTestId('code-step')).toHaveTextContent('d4')
        await waitFor(() => expect(payable).toBe('d4'))
        first.unmount()

        // back from Home: a fresh mount, no id in the URL
        renderAt('', { payable })
        expect(screen.getByTestId('code-step')).toHaveTextContent('d4')
        expect(screen.queryByTestId('amount-step')).toBeNull()
        expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('opens the code that can still be paid instead of the amount step, and names it in the URL', async () => {
        const urls: string[] = []
        renderAt('', { payable: 'd3', onUrlUpdate: (event) => urls.push(event.queryString) })

        expect(screen.getByTestId('code-step')).toHaveTextContent('d3')
        expect(screen.queryByTestId('amount-step')).toBeNull()
        await waitFor(() => expect(urls.some((url) => url.includes('intentId=d3'))).toBe(true))
    })

    it('a new deposit from a lapsed code goes to the amount step and reads the route again', async () => {
        renderAt('?step=showQR&intentId=d3', { payable: 'd3' })

        fireEvent.click(screen.getByText('new deposit'))

        // the capabilities may still name the left code payable: it does not open again
        expect(await screen.findByTestId('amount-step')).toBeInTheDocument()
        expect(screen.queryByTestId('code-step')).toBeNull()
        expect(mockFetchUser).toHaveBeenCalled()
    })
})
