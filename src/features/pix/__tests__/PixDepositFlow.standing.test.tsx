/** @jest-environment jsdom */
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { CapabilityRoute } from '@/types/capabilities'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: jest.fn(), userId: undefined }) }))
const mockQuote = jest.fn((..._args: unknown[]) => ({ code: 'BRL', price: { sell: 5.4, buy: 5.5 } }))
jest.mock('@/features/pix/usePixQuoteCurrency', () => ({
    usePixQuoteCurrency: (...args: unknown[]) => mockQuote(...args),
}))
jest.mock('@/features/pix/usePixStandingPayerLine', () => ({
    usePixStandingPayerLine: () => 'Only you or a business can pay in.',
}))
jest.mock('@/components/AddMoney/components/InputAmountStep', () => ({
    __esModule: true,
    default: () => <div data-testid="amount-step" />,
}))
jest.mock('@/features/pix/components/PixSetup', () => ({ PixSetup: () => <div data-testid="setup" /> }))
jest.mock('@/features/pix/components/PixQrDeposit', () => ({
    PixQrDeposit: ({
        intentId,
        minimumBrl,
        payerLine,
    }: {
        intentId: string | null
        minimumBrl?: string | null
        payerLine?: string
    }) => (
        <div data-testid="code-step">
            {intentId === null ? 'standing' : intentId} {minimumBrl} {payerLine}
        </div>
    ),
}))
jest.mock('@/services/pix', () => ({ pixApi: { createDeposit: jest.fn() } }))

import { PixDepositFlow } from '../components/PixDepositFlow'

const bridgeRoute = (state: CapabilityRoute['state']): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'bridge',
    state,
    limits: { minAmount: '10', currency: 'BRL' },
    standingCode: true,
    candidates: [{ provider: 'bridge', state }],
})

const renderAt = (route: CapabilityRoute, searchParams = '', onUrlUpdate?: (event: UrlUpdateEvent) => void) =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                <PixDepositFlow route={route} />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )

// ruling D7: a standing code skips the amount and the wait
describe('PixDepositFlow on a standing-code route', () => {
    beforeEach(() => jest.clearAllMocks())

    it('opens the code screen on the standing code, with the minimum and who may pay', () => {
        renderAt(bridgeRoute('ready'))
        expect(screen.getByTestId('code-step')).toHaveTextContent('standing 10 Only you or a business can pay in.')
        expect(screen.queryByTestId('amount-step')).toBeNull()
    })

    it('asks for no quote: there is no amount to quote', () => {
        renderAt(bridgeRoute('ready'))
        expect(mockQuote).toHaveBeenCalled()
        for (const call of mockQuote.mock.calls) expect(call[3]).toBe(false)
    })

    it('writes nothing to the URL, so a reload asks for the same code again', () => {
        const urls: string[] = []
        renderAt(bridgeRoute('ready'), '', (event) => urls.push(event.queryString))
        expect(urls).toEqual([])
    })

    it('ignores an amount left in the URL', () => {
        renderAt(bridgeRoute('ready'), '?amount=100&currency=BRL')
        expect(screen.getByTestId('code-step')).toHaveTextContent('standing')
    })

    it('keeps the setup while the route is not ready', () => {
        renderAt(bridgeRoute('pending'))
        expect(screen.getByTestId('setup')).toBeInTheDocument()
        expect(screen.queryByTestId('code-step')).toBeNull()
    })
})
