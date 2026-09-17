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
const mockInstructions = { amount: '40', iban: 'DE001234', bic: 'TEST', depositMessage: 'TEST123' }

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
})

it.each(['germany', 'france', 'poland'])(
    'keeps EUR in native %s confirmation, copy, share and quote',
    async (country) => {
        mockQueryCountry = country
        renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
        expect(screen.getByText('€40.00')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Copy €40.00' })).toBeInTheDocument()
        expect(mockQuote).toHaveBeenCalledWith({ accountType: 'iban', enabled: true })
        fireEvent.click(screen.getByText('Share'))
        await waitFor(() => expect(mockShare).toHaveBeenCalledWith(expect.stringContaining('€40.00')))
    }
)

it('keeps the web path country ahead of query state', () => {
    mockPathCountry = 'germany'
    mockQueryCountry = 'us'
    renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(screen.getByText('€40.00')).toBeInTheDocument()
})

it('keeps USD for the US fallback', () => {
    renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    expect(screen.getByText('$40.00')).toBeInTheDocument()
})

it('uses the request country instead of add-money URL state', () => {
    mockRequestCountry = countryData.find((country) => country.path === 'germany')
    mockQueryCountry = 'us'
    renderWithIntl(<AddMoneyBankDetails flow="request-fulfillment" />)
    expect(screen.getByText('€40.00')).toBeInTheDocument()
})
