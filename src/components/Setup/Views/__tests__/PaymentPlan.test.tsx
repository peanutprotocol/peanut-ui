/** @jest-environment jsdom */
import { useEffect } from 'react'
import { fireEvent, screen, within, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import PaymentPlanStep from '../PaymentPlan'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { KYC_INTENTS_BY_COUNTRY } from '@/test-utils/kycIntents.fixture'

let mockSets = LOCAL_RESIDENCE_RESTRICTION_SETS
let mockSettled = true
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    ...jest.requireActual('@/hooks/useResidenceRestrictionSets'),
    useResidenceRestrictionSetsWithStatus: () => ({ sets: mockSets, settled: mockSettled }),
}))
let mockIntentsSettled = true
jest.mock('@/hooks/useKycIntents', () => ({
    useKycIntents: (country: string) => ({
        intents: mockIntentsSettled ? KYC_INTENTS_BY_COUNTRY[country] : undefined,
        settled: mockIntentsSettled,
    }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
const mockNext = jest.fn()
let mockIsLoading = false
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockNext, isLoading: mockIsLoading }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

function Fixture({ country }: { country: string }) {
    const c = useSetupFlowContext()
    useEffect(() => {
        c.setResidenceCountry(country)
    }, [country, c.setResidenceCountry])
    return (
        <>
            <PaymentPlanStep />
            <output aria-label="Plan">
                {c.fundingChannel}/{c.paymentChannel}
            </output>
        </>
    )
}
const ui = (country: string) => (
    <SetupFlowProvider masterScreenIds={['payment-plan']}>
        <Fixture country={country} />
    </SetupFlowProvider>
)
const continueButton = () => screen.getByRole('button', { name: 'Continue', hidden: true })
async function choose(kind: 'Add money with' | 'Make a payment with', current: string, choice: string) {
    fireEvent.click(screen.getByRole('button', { name: `${kind}: ${current}`, hidden: true }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: choice }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
}
function optionsIn(kind: 'Add money with' | 'Make a payment with', current = 'Choose') {
    fireEvent.click(screen.getByRole('button', { name: `${kind}: ${current}`, hidden: true }))
    return within(screen.getByRole('dialog'))
        .getAllByRole('button')
        .map((x) => x.getAttribute('aria-label'))
}
beforeEach(() => {
    mockSets = LOCAL_RESIDENCE_RESTRICTION_SETS
    mockSettled = true
    mockIntentsSettled = true
    mockIsLoading = false
    jest.clearAllMocks()
})

it('starts both pickers on Choose and keeps Continue disabled until both are set', async () => {
    renderWithIntl(ui('PT'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/You’ll first add money\s*with/)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/then spend\s*with/)
    expect(screen.getByRole('button', { name: 'Add money with: Choose' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make a payment with: Choose' })).toBeInTheDocument()
    expect(screen.getByLabelText('Plan')).toHaveTextContent('/')
    expect(continueButton()).toBeDisabled()

    await choose('Add money with', 'Choose', 'Bank transfer (USD, EUR, GBP)')
    expect(continueButton()).toBeDisabled()
    fireEvent.click(continueButton())
    expect(mockNext).not.toHaveBeenCalled()

    await choose('Make a payment with', 'Choose', 'QR payments')
    expect(screen.getByLabelText('Plan')).toHaveTextContent('bank/qr')
    expect(continueButton()).toBeEnabled()
    fireEvent.click(continueButton())
    expect(mockNext).toHaveBeenCalledTimes(1)
})

it('marks the chosen row with the selection fill and a check', async () => {
    renderWithIntl(ui('PT'))
    await choose('Make a payment with', 'Choose', 'Peanut Card')
    fireEvent.click(screen.getByRole('button', { name: 'Make a payment with: Peanut Card', hidden: true }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Peanut Card' })).toHaveClass('bg-background-selection')
    expect(within(dialog).getByRole('button', { name: 'QR payments' })).not.toHaveClass('bg-background-selection')
})

it.each([
    ['PT', ['Peanut Card', 'QR payments']],
    ['BR', ['Peanut Card', 'QR payments']],
    ['GB', ['QR payments']],
    ['UA', ['QR payments']],
    ['IR', ['Another Peanut user']],
])('offers only the card and QR payments to spend in %s, with a Peanut fallback', (country, expected) => {
    renderWithIntl(ui(country))
    expect(optionsIn('Make a payment with')).toEqual(expected)
})

it.each([
    ['BR', 'BRL'],
    ['AR', 'ARS'],
] as const)('keeps the %s funding text compact and its accessible label complete', async (country, currency) => {
    renderWithIntl(ui(country))
    expect(optionsIn('Add money with')).toEqual([
        `Bank transfer (${currency})`,
        'Bank transfer (USD, EUR, GBP)',
        'Crypto',
        'Another Peanut user',
    ])
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: `Bank transfer (${currency})` }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    const funding = screen.getByTestId('setup-funding-channel')
    expect(funding).toHaveAccessibleName(`Add money with: Bank transfer (${currency})`)
    expect(funding).not.toHaveTextContent(/\(/)
})

// Slava, 2026-10-27: Brazil named its bank currencies, North Macedonia did not.
it.each([
    ['MK', ['Bank transfer (USD, EUR, GBP)', 'Crypto', 'Another Peanut user']],
    ['DE', ['Bank transfer (USD, EUR, GBP)', 'Crypto', 'Another Peanut user']],
    ['MX', ['Bank transfer (USD, EUR, GBP, MXN)', 'Crypto', 'Another Peanut user']],
    // the server closes banking here, though no tier list names it
    ['KR', ['Crypto', 'Another Peanut user']],
])('names the bank currencies wherever the server opens the bank feature: %s', (country, expected) => {
    renderWithIntl(ui(country))
    expect(optionsIn('Add money with')).toEqual(expected)
})

it('names a Peanut-to-Peanut top-up "Another Peanut user"', async () => {
    renderWithIntl(ui('JP'))
    await choose('Add money with', 'Choose', 'Another Peanut user')
    expect(screen.getByLabelText('Plan')).toHaveTextContent('peanut/')
})

it('clears a choice the residence no longer offers and asks again', async () => {
    const view = renderWithIntl(ui('PT'))
    await choose('Add money with', 'Choose', 'Bank transfer (USD, EUR, GBP)')
    await choose('Make a payment with', 'Choose', 'Peanut Card')
    // Japan: the server closes the bank feature and keeps the card
    view.rerender(ui('JP'))
    await waitFor(() => expect(screen.getByLabelText('Plan')).toHaveTextContent(/^\/card$/))
    expect(screen.getByRole('button', { name: 'Add money with: Choose', hidden: true })).toBeInTheDocument()
    expect(continueButton()).toBeDisabled()
})

it('offers only universal channels while the restriction lookup is unsettled', async () => {
    mockSettled = false
    mockIntentsSettled = false
    renderWithIntl(ui('PT'))
    await choose('Add money with', 'Choose', 'Crypto')
    await choose('Make a payment with', 'Choose', 'Another Peanut user')
    fireEvent.click(continueButton())
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/peanut')
})

it('reports a fully restricted resident continuing, and only them', async () => {
    renderWithIntl(ui('GB'))
    await choose('Add money with', 'Choose', 'Crypto')
    await choose('Make a payment with', 'Choose', 'QR payments')
    fireEvent.click(continueButton())
    expect(posthog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED,
        expect.objectContaining({ residence_country: 'GB' })
    )

    expect(mockNext).toHaveBeenCalledTimes(1)
})

it('does not report an unrestricted resident as restricted', async () => {
    renderWithIntl(ui('PT'))
    await choose('Add money with', 'Choose', 'Crypto')
    await choose('Make a payment with', 'Choose', 'QR payments')
    fireEvent.click(continueButton())
    expect(posthog.capture).not.toHaveBeenCalledWith(
        ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED,
        expect.anything()
    )
    expect(mockNext).toHaveBeenCalledTimes(1)
})

it.each(['GB', 'IN', 'PT'])('shows the one-line residence hint for %s', (country) => {
    renderWithIntl(ui(country))
    expect(screen.getByText('Options depend on your residence.')).toBeInTheDocument()
    expect(
        screen.queryByText(/aren’t available in your country|isn’t available in your country/)
    ).not.toBeInTheDocument()
})
