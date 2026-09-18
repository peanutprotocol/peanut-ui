import type { RequestDepositInstructions } from '@/services/services.types'
import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AnonymousBankRequestView } from '../AnonymousBankRequestView'

const useRequestDepositInstructions = jest.fn()
jest.mock('@/features/deposit-accounts/useRequestDepositInstructions', () => ({
    useRequestDepositInstructions: (...args: unknown[]) => useRequestDepositInstructions(...args),
}))

const useDepositAccountsEnabled = jest.fn()
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => useDepositAccountsEnabled(),
}))

const getRequest = jest.fn()
jest.mock('@/services/requests', () => ({
    requestsApi: { get: (...args: unknown[]) => getRequest(...args) },
}))

jest.mock('@/features/payments/flows/contribute-pot/ContributePotPageWrapper', () => ({
    ContributePotPageWrapper: () => <div data-testid="contribute-pot" />,
}))

jest.mock('@/hooks/useExchangeRate', () => ({ useExchangeRate: () => ({ exchangeRate: 1.1 }) }))

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))

const instructions: RequestDepositInstructions = {
    paymentReference: 'PNT-8842',
    depositAccount: {
        id: 'acc-1',
        country: 'DE',
        currency: 'EUR',
        railId: 'bridge.sepa_eu',
        isPrimary: true,
        status: 'active',
        matching: { nameOnAccount: 'user', sender: 'business-only' },
        instructions: { accountHolderName: 'Ana Silva', iban: 'DE89370400440532013000', paymentRails: ['sepa'] },
    },
} as RequestDepositInstructions

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
        <IntlWrapper>
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </IntlWrapper>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    getRequest.mockResolvedValue({ uuid: 'req-1', tokenAmount: '250', tokenSymbol: 'USDC' })
    useDepositAccountsEnabled.mockReturnValue(true)
})

describe('AnonymousBankRequestView', () => {
    it('leads a signed-out payer with the currency bank option when the request opted in', async () => {
        useRequestDepositInstructions.mockReturnValue({ instructions, isLoading: false, isUnavailable: false })

        render(<AnonymousBankRequestView requestId="req-1" />, { wrapper })

        expect(await screen.findByText('Pay in EUR · SEPA')).toBeInTheDocument()
        expect(screen.queryByTestId('contribute-pot')).not.toBeInTheDocument()
    })

    it('shows no bank option and hands off to the normal flow for a request that did not opt in', async () => {
        useRequestDepositInstructions.mockReturnValue({
            instructions: undefined,
            isLoading: false,
            isUnavailable: true,
        })

        render(<AnonymousBankRequestView requestId="req-1" />, { wrapper })

        expect(await screen.findByTestId('contribute-pot')).toBeInTheDocument()
        expect(screen.queryByText('Pay in EUR · SEPA')).not.toBeInTheDocument()
    })

    it('lets the payer switch to the other ways to pay', async () => {
        useRequestDepositInstructions.mockReturnValue({ instructions, isLoading: false, isUnavailable: false })

        render(<AnonymousBankRequestView requestId="req-1" />, { wrapper })

        fireEvent.click(await screen.findByText('Pay another way'))

        await waitFor(() => expect(screen.getByTestId('contribute-pot')).toBeInTheDocument())
    })

    it('does not read the deposit instructions while the feature flag is off', async () => {
        useDepositAccountsEnabled.mockReturnValue(false)
        useRequestDepositInstructions.mockReturnValue({
            instructions: undefined,
            isLoading: false,
            isUnavailable: false,
        })

        render(<AnonymousBankRequestView requestId="req-1" />, { wrapper })

        // The hook is called with enabled=false, so no request goes out; the page
        // hands off to the normal flow.
        await screen.findByTestId('contribute-pot')
        expect(useRequestDepositInstructions).toHaveBeenCalledWith('req-1', false)
    })
})
