import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { fail, io, ok, rainOverview, resetIo, units } from '@/test-utils/balance-io'
import { DirectSendFlowProvider } from '../../DirectSendFlowContext'
import { SendInputView } from '../SendInputView'

jest.mock('@/utils/api-fetch', () => require('@/test-utils/balance-io').apiFetchModule)
jest.mock('@/utils/auth-token', () => ({
    ...jest.requireActual('@/utils/auth-token'),
    getAuthToken: () => 'test-token',
}))
jest.mock('@/app/actions/clients', () => require('@/test-utils/balance-io').clientsModule)
jest.mock('@/context/authContext', () => require('@/test-utils/balance-io').authModule)
jest.mock('@/hooks/useZeroDev', () => require('@/test-utils/balance-io').zeroDevModule)
jest.mock('@/hooks/wallet/useSendMoney', () => ({ useSendMoney: () => ({ mutateAsync: jest.fn() }) }))
jest.mock('@/hooks/wallet/useSpendBundle', () => ({ useSpendBundle: () => ({ spend: jest.fn() }) }))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: jest.fn(),
        onFeatureFlags: () => () => {},
        isFeatureEnabled: () => false,
        getFeatureFlag: () => undefined,
    },
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
    usePathname: () => '/send/bob',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/User/UserCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: () => null,
}))

const RECIPIENT = { username: 'bob', address: `0x${'22'.repeat(20)}` as `0x${string}`, userId: 'bob-id' }

let client: QueryClient
beforeEach(() => {
    resetIo()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
})
afterEach(() => {
    cleanup()
    client.clear()
    jest.restoreAllMocks()
})

const showSend = () =>
    render(
        <IntlWrapper>
            <QueryClientProvider client={client}>
                <DirectSendFlowProvider initialRecipient={RECIPIENT}>
                    <SendInputView />
                </DirectSendFlowProvider>
            </QueryClientProvider>
        </IntlWrapper>
    )
const typeAmount = (value: string) => fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value } })
const ctaButton = () =>
    screen.getByRole('button', { name: new RegExp(`${en.payment.cta.addFundsTo}|${en.payment.cta.sendWith}`) })

describe('direct send balance (U4, U5)', () => {
    it('shows exchange guidance for an in-transit-only shortfall while Send stays disabled', async () => {
        // smart 0, landed collateral 0, $10 still in transit; 20 EURC on Base.
        io.smartBalance.mockResolvedValue(0n)
        io.rain.mockImplementation(() => ok(rainOverview({ spendingPowerCents: 0, inTransitCents: 1_000 })))
        showSend()
        await waitFor(() => expect(io.rain).toHaveBeenCalled())
        typeAmount('5')

        expect(await screen.findByText(en.payment.errors.insufficientPayment)).toBeInTheDocument()
        expect(await screen.findByText(en.currencyAccounts.convertedBalanceWarning)).toBeInTheDocument()
        expect(ctaButton()).toBeDisabled()
    })

    it('hides an unknown dollar balance instead of showing Balance: $0.00, then shows it once known', async () => {
        io.smartBalance.mockResolvedValue(units(10))
        io.rain.mockImplementation(() => fail())
        showSend()
        await waitFor(() => expect(io.rain).toHaveBeenCalled())
        await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))

        expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument()
        expect(screen.queryByText(new RegExp(`^${en.global.amountInput.balance}`))).not.toBeInTheDocument()

        io.rain.mockImplementation(() => ok(rainOverview()))
        await act(async () => {
            await client.refetchQueries()
        })
        expect(await screen.findByText(/\$10\.00/)).toBeInTheDocument()
    })
})
