import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import AddMoneyBankDetails from '../AddMoneyBankDetails'

/**
 * The text a user copies or shares to whoever is paying them.
 *
 * Every line falls back to "Loading" while the provider answer is on its way.
 * Four lines did not, and `String(undefined)` is the word "undefined" — sent
 * to a payer as the beneficiary name on a bank transfer.
 */
let mockQueryCountry: string | null = null
// the not-yet-loaded state: the call has answered with no beneficiary fields
const mockInstructions: Record<string, string> = { amount: '40' }
const mockShare = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
    useParams: () => ({ country: undefined }),
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
        selectedCountry: undefined,
        onrampData: { depositInstructions: mockInstructions },
    }),
    RequestFulfillmentBankFlowStep: {},
}))
jest.mock('@/hooks/useOnrampQuote', () => ({ useOnrampQuote: () => ({ netRate: 1.1, isLoading: false }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({
    __esModule: true,
    default: () => null,
}))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({
    PaymentInfoRow: () => null,
}))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ generateText }: { generateText: () => Promise<string> }) => (
        <button onClick={async () => mockShare(await generateText())}>Share</button>
    ),
}))

const shareText = async (country: string | null) => {
    mockQueryCountry = country
    renderWithIntl(<AddMoneyBankDetails onBack={jest.fn()} />)
    fireEvent.click(screen.getByText('Share'))
    await waitFor(() => expect(mockShare).toHaveBeenCalled())
    return mockShare.mock.calls[0][0] as string
}

beforeEach(() => {
    jest.clearAllMocks()
})

it.each([
    ['us', 'the beneficiary name and address'],
    ['mexico', 'the account holder'],
    ['germany', 'the account holder'],
])('never shares the word "undefined" in place of %s details (%s)', async (country) => {
    const text = await shareText(country)

    expect(text).not.toMatch(/undefined/)
})
