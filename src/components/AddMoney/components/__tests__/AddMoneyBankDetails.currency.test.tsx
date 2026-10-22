import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { countryData } from '@/components/AddMoney/consts'
import AddMoneyBankDetails from '../AddMoneyBankDetails'

let mockPathCountry: string | undefined
let mockQueryCountry: string | null
let mockRequestCountry: (typeof countryData)[number] | undefined
const mockQuote = jest.fn((_options: unknown) => ({ netRate: 1.1, isLoading: false }))
const mockShare = jest.fn()
const EUR_INSTRUCTIONS = { amount: '40', iban: 'DE001234', bic: 'TEST', depositMessage: 'TEST123' }
let mockInstructions: Record<string, string> = EUR_INSTRUCTIONS

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useParams: () => ({ country: mockPathCountry }),
}))
jest.mock('nuqs', () => ({
    useQueryState: (key: string) => [key === 'amount' ? '40' : mockQueryCountry],
    parseAsString: {},
}))
jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => ({ onrampData: { depositInstructions: mockInstructions } }),
}))
jest.mock('@/context/RequestFulfillmentFlowContext', () => ({
    useRequestFulfillmentFlow: () => ({
        selectedCountry: mockRequestCountry,
        onrampData: { depositInstructions: mockInstructions },
    }),
    RequestFulfillmentBankFlowStep: {},
}))
jest.mock('@/hooks/useOnrampQuote', () => ({ useOnrampQuote: (...args: unknown[]) => mockQuote(args[0]) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({
    __esModule: true,
    default: ({ textToCopy }: { textToCopy: string }) => <button aria-label={`Copy ${textToCopy}`} />,
}))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: ({ label, value }: { label: string; value: string }) => (
        <p>
            {label}: {value}
        </p>
    ),
}))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ generateText }: { generateText: () => Promise<string> }) => (
        <button onClick={async () => mockShare(await generateText())}>Share</button>
    ),
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockPathCountry = undefined
    mockQueryCountry = null
    mockRequestCountry = undefined
    mockInstructions = EUR_INSTRUCTIONS
})

it.each(['germany', 'france', 'poland'])(
    'keeps EUR in native %s confirmation, copy, share and quote',
    async (country) => {
        mockQueryCountry = country
        renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
        expect(screen.getByText('€40')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Copy €40' })).toBeInTheDocument()
        expect(mockQuote).toHaveBeenCalledWith({ accountType: 'iban', enabled: true })
        fireEvent.click(screen.getByText('Share'))
        await waitFor(() => expect(mockShare).toHaveBeenCalledWith(expect.stringContaining('€40')))
    }
)

it('keeps the web path country ahead of query state', () => {
    mockPathCountry = 'germany'
    mockQueryCountry = 'us'
    renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(screen.getByText('€40')).toBeInTheDocument()
})

it('keeps USD for the US fallback', () => {
    renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(screen.getByText('$40')).toBeInTheDocument()
})

it('uses the request country instead of add-money URL state', () => {
    mockRequestCountry = countryData.find((country) => country.path === 'germany')
    mockQueryCountry = 'us'
    renderWithIntl(<AddMoneyBankDetails flow="request-fulfillment" />)
    expect(screen.getByText('€40')).toBeInTheDocument()
})

// TASK-23924: the native app once lost the country on this screen, so a UK
// top-up fell back to the US and showed "$7.00" with an IBAN and BIC of "N/A".
// The API's answer names the currency and holds the sort code, so it decides.
describe('a UK top-up whose country the route lost', () => {
    beforeEach(() => {
        mockInstructions = {
            amount: '40',
            currency: 'gbp',
            sortCode: '04-00-53',
            accountNumber: '00000001',
            depositMessage: 'TEST123',
        }
    })

    it('shows pounds, the sort code and the account number, and no IBAN or BIC', async () => {
        renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
        expect(screen.getByText('£40')).toBeInTheDocument()
        expect(screen.getByText(/Sort code: 04-00-53/)).toBeInTheDocument()
        expect(screen.getByText(/Account number: 00000001/)).toBeInTheDocument()
        expect(screen.queryByText(/IBAN/)).not.toBeInTheDocument()
        expect(screen.queryByText(/BIC/)).not.toBeInTheDocument()
        expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument()
        expect(mockQuote).toHaveBeenCalledWith({ accountType: 'gb', enabled: true })

        fireEvent.click(screen.getByText('Share'))
        await waitFor(() => expect(mockShare).toHaveBeenCalled())
        const shared = mockShare.mock.calls[0][0] as string
        expect(shared).toContain('£40')
        expect(shared).toContain('04-00-53')
        expect(shared).toContain('00000001')
        expect(shared).not.toMatch(/IBAN|BIC/)
    })

    it('keeps the answer ahead of a URL country that says otherwise', () => {
        mockQueryCountry = 'germany'
        renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
        expect(screen.getByText('£40')).toBeInTheDocument()
        expect(screen.getByText(/Sort code: 04-00-53/)).toBeInTheDocument()
    })
})
