/** @jest-environment jsdom */
import { useEffect } from 'react'
import { act, fireEvent, screen, within, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import PaymentPlan from '../PaymentPlan'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'
let mockSets = LOCAL_RESIDENCE_RESTRICTION_SETS
let mockSettled = true
let mockReducedMotion = false
jest.mock('framer-motion', () => ({
    ...jest.requireActual('framer-motion'),
    useReducedMotion: () => mockReducedMotion,
}))
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    ...jest.requireActual('@/hooks/useResidenceRestrictionSets'),
    useResidenceRestrictionSetsWithStatus: () => ({ sets: mockSets, settled: mockSettled }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
const next = jest.fn()
function Fixture({ country, defaults = false }: { country: string; defaults?: boolean }) {
    const c = useSetupFlowContext()
    useEffect(() => {
        c.setResidenceCountry(country)
    }, [country, c.setResidenceCountry])
    return (
        <>
            <PaymentPlan onContinue={next} animateSuggestions={!defaults} />
            <output aria-label="Plan">
                {c.fundingChannel}/{c.paymentChannel}
            </output>
        </>
    )
}
const ui = (country: string, defaults = false) => (
    <SetupFlowProvider masterScreenIds={['residence']}>
        <Fixture country={country} defaults={defaults} />
    </SetupFlowProvider>
)
async function choose(kind: 'Add money with' | 'Make a payment with', current: string, choice: string) {
    fireEvent.click(screen.getByRole('button', { name: `${kind}: ${current}`, hidden: true }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: choice }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
}
beforeEach(() => {
    mockSets = LOCAL_RESIDENCE_RESTRICTION_SETS
    mockSettled = true
    mockReducedMotion = false
    next.mockClear()
})
it('starts with both first options visible and accepts or changes them through the real drawers', async () => {
    renderWithIntl(ui('PT'))
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add money with: Bank transfer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make a payment with: Peanut card' })).toBeInTheDocument()
    await choose('Add money with', 'Bank transfer', 'Crypto')
    await choose('Make a payment with', 'Peanut card', 'QR payments')
    expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/qr')
    fireEvent.click(screen.getByRole('button', { name: 'Looks good', hidden: true }))
    expect(next).toHaveBeenCalledTimes(1)
})
it('groups bank providers, excludes cash, and leaves Peanut payments last', () => {
    renderWithIntl(ui('BR'))
    fireEvent.click(screen.getByRole('button', { name: 'Add money with: Bank transfer (BRL)' }))
    const dialog = screen.getByRole('dialog')
    expect(
        within(dialog)
            .getAllByRole('button')
            .map((x) => x.getAttribute('aria-label'))
    ).toEqual(['Bank transfer (BRL)', 'Bank transfer', 'Crypto', 'Peanut to Peanut'])
    expect(within(dialog).queryByText('Cash')).not.toBeInTheDocument()
})
it('offers both card and QR in Brazil, and allows a deliberate Crypto payment choice', async () => {
    renderWithIntl(ui('BR'))
    fireEvent.click(screen.getByRole('button', { name: 'Make a payment with: Peanut card' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Peanut card' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'QR payments' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crypto' }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('/crypto')
})
it.each([
    ['BR', 'Bank transfer (BRL)', 'QR payments'],
    ['AR', 'Bank transfer (ARS)', 'QR payments'],
])('keeps first-party bank rails out of the payment drawer for %s', (country, ownAccountRail, qrPayment) => {
    renderWithIntl(ui(country))
    fireEvent.click(screen.getByRole('button', { name: 'Make a payment with: Peanut card' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: ownAccountRail })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Bank transfer' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: qrPayment })).toBeInTheDocument()
})
it('clears newly restricted choices and displays valid fallback options', async () => {
    const view = renderWithIntl(ui('PT'))
    await choose('Add money with', 'Bank transfer', 'Bank transfer')
    await choose('Make a payment with', 'Peanut card', 'Peanut card')
    mockSets = { ...LOCAL_RESIDENCE_RESTRICTION_SETS, full: new Set(['PT']) }
    view.rerender(ui('PT'))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('/')
    expect(screen.getByRole('button', { name: 'Looks good', hidden: true })).toBeEnabled()
    expect(screen.getByText('Bank transfers and card issuing aren’t available in your country.')).toBeInTheDocument()
})
it('can continue with explicitly selected universal channels when the restriction lookup fails', async () => {
    mockSettled = false
    renderWithIntl(ui('PT'))
    await choose('Add money with', 'Crypto', 'Crypto')
    await choose('Make a payment with', 'Peanut to Peanut', 'Peanut to Peanut')
    fireEvent.click(screen.getByRole('button', { name: 'Looks good', hidden: true }))
    expect(next).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/peanut')
})
it('never picks Crypto automatically for payment in a preselected presentation', () => {
    renderWithIntl(ui('UA', true))
    expect(screen.getByRole('button', { name: 'Make a payment with: Bank transfer' })).toBeInTheDocument()
    expect(screen.getByText('The Peanut card isn’t available in your country.')).toBeInTheDocument()
})
it('waits 3.5 seconds, then alternates every two seconds and freezes the visible pair on opening either drawer', () => {
    jest.useFakeTimers()
    try {
        renderWithIntl(ui('PT'))
        act(() => jest.advanceTimersByTime(3499))
        expect(screen.getByRole('button', { name: 'Add money with: Bank transfer' })).toBeInTheDocument()
        act(() => jest.advanceTimersByTime(1))
        expect(screen.getByRole('button', { name: 'Add money with: Crypto' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Make a payment with: Peanut card' })).toBeInTheDocument()
        act(() => jest.advanceTimersByTime(2000))
        expect(screen.getByRole('button', { name: 'Make a payment with: Bank transfer' })).toBeInTheDocument()
        act(() => jest.advanceTimersByTime(2000))
        const funding = screen.getByRole('button', { name: 'Add money with: Peanut to Peanut' })
        fireEvent.click(funding)
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByRole('button', { name: 'Peanut to Peanut' })).toHaveClass('bg-background-selection')
        expect(screen.getByLabelText('Plan')).toHaveTextContent('peanut/bank')
        act(() => jest.advanceTimersByTime(16000))
        expect(funding).toHaveAccessibleName('Add money with: Peanut to Peanut')
        expect(
            screen.getByRole('button', { name: 'Make a payment with: Bank transfer', hidden: true })
        ).toBeInTheDocument()
    } finally {
        jest.useRealTimers()
    }
})
it('saves both initially visible defaults immediately on Continue', () => {
    renderWithIntl(ui('BR'))
    fireEvent.click(screen.getByRole('button', { name: 'Looks good' }))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('brlBank/card')
    expect(next).toHaveBeenCalledTimes(1)
})
it('saves the currently visible suggestions on Continue', () => {
    jest.useFakeTimers()
    try {
        renderWithIntl(ui('BR'))
        act(() => jest.advanceTimersByTime(5500))
        fireEvent.click(screen.getByRole('button', { name: 'Looks good' }))
        expect(screen.getByLabelText('Plan')).toHaveTextContent('bank/bank')
    } finally {
        jest.useRealTimers()
    }
})
it('does not rotate for reduced motion, and keyboard focus stops both suggestions', () => {
    jest.useFakeTimers()
    try {
        mockReducedMotion = true
        const view = renderWithIntl(ui('PT'))
        act(() => jest.advanceTimersByTime(8000))
        expect(screen.getByRole('button', { name: 'Add money with: Bank transfer' })).toBeInTheDocument()
        mockReducedMotion = false
        view.rerender(ui('PT'))
        act(() => jest.advanceTimersByTime(5500))
        fireEvent.focus(screen.getByRole('button', { name: 'Make a payment with: Bank transfer' }))
        act(() => jest.advanceTimersByTime(8000))
        expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/bank')
    } finally {
        jest.useRealTimers()
    }
})
it('never cycles through Crypto as a payment suggestion', () => {
    jest.useFakeTimers()
    try {
        renderWithIntl(ui('GB'))
        for (let i = 0; i < 9; i++) {
            act(() => jest.advanceTimersByTime(4000))
            expect(screen.queryByRole('button', { name: 'Make a payment with: Crypto' })).not.toBeInTheDocument()
        }
    } finally {
        jest.useRealTimers()
    }
})
it('saves the displayed fallback defaults on Continue while the lookup remains unsettled', () => {
    mockSettled = false
    renderWithIntl(ui('PT', true))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('/')
    fireEvent.click(screen.getByRole('button', { name: 'Looks good' }))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/peanut')
    expect(next).toHaveBeenCalledTimes(1)
})
it.each([
    ['GB', 'Bank transfers and card issuing aren’t available in your country.'],
    ['IN', 'The Peanut card isn’t available in your country.'],
])('explains the unavailable services for %s without promising future availability', (country, guidance) => {
    renderWithIntl(ui(country))
    expect(screen.getByText(guidance)).toBeInTheDocument()
    expect(screen.getByText('The list of payment options depends on your country of residence.')).toBeInTheDocument()
    expect(screen.queryByText(/available later/i)).not.toBeInTheDocument()
})
