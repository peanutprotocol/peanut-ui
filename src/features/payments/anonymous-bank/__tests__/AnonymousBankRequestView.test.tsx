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

    // The payer's own rollout cohort must not decide access — the server's
    // opt-in/404 does. The read is always enabled; a request that did not opt in
    // is answered by isUnavailable, not by withholding the request.
    it('reads the deposit instructions regardless of the payer rollout cohort', async () => {
        useRequestDepositInstructions.mockReturnValue({ instructions, isLoading: false, isUnavailable: false })

        render(<AnonymousBankRequestView requestId="req-1" />, { wrapper })

        expect(await screen.findByText('Pay in EUR · SEPA')).toBeInTheDocument()
        expect(useRequestDepositInstructions).toHaveBeenCalledWith('req-1', true)
    })

    // A failed request read means no trustworthy amount, so the bank view is
    // withheld and the normal flow (which loads the request itself) takes over.
    it('hands off to the normal flow when the request read fails', async () => {
        getRequest.mockRejectedValue(new Error('network'))
        useRequestDepositInstructions.mockReturnValue({ instructions, isLoading: false, isUnavailable: false })

        render(<AnonymousBankRequestView requestId="req-1" />, { wrapper })

        expect(await screen.findByTestId('contribute-pot')).toBeInTheDocument()
        expect(screen.queryByText('Pay in EUR · SEPA')).not.toBeInTheDocument()
    })
})
