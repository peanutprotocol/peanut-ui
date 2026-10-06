/** @jest-environment jsdom */
import { useEffect } from 'react'
import { fireEvent, screen, within, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import PaymentPlan from '../PaymentPlan'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'
let mockSets = LOCAL_RESIDENCE_RESTRICTION_SETS
let mockSettled = true
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
            <PaymentPlan onContinue={next} selectionRequired={!defaults} />
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
    next.mockClear()
})
it('requires both deliberate choices and preserves them after closing the real drawers', async () => {
    renderWithIntl(ui('PT'))
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeDisabled()
    await choose('Add money with', 'Choose a method', 'Bank transfer')
    expect(screen.getByRole('button', { name: 'Looks good', hidden: true })).toBeDisabled()
    await choose('Make a payment with', 'Choose a method', 'Peanut card')
    expect(screen.getByLabelText('Plan')).toHaveTextContent('bank/card')
    expect(screen.getByRole('button', { name: 'Looks good', hidden: true })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Looks good', hidden: true }))
    expect(next).toHaveBeenCalledTimes(1)
})
it('groups bank providers, excludes cash, and leaves Peanut payments last', () => {
    renderWithIntl(ui('BR'))
    fireEvent.click(screen.getByRole('button', { name: 'Add money with: Choose a method' }))
    const dialog = screen.getByRole('dialog')
    expect(
        within(dialog)
            .getAllByRole('button')
            .map((x) => x.getAttribute('aria-label'))
    ).toEqual(['Bank transfer (BRL)', 'Bank transfer', 'Crypto', 'Peanut-to-Peanut payments'])
    expect(within(dialog).queryByText('Cash')).not.toBeInTheDocument()
})
it('offers both card and Pix in Brazil, and allows a deliberate Crypto payment choice', async () => {
    renderWithIntl(ui('BR'))
    fireEvent.click(screen.getByRole('button', { name: 'Make a payment with: Choose a method' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Peanut card' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Pix payments' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crypto' }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('/crypto')
})
it('clears newly restricted choices and disables Continue until the user selects valid replacements', async () => {
    const view = renderWithIntl(ui('PT'))
    await choose('Add money with', 'Choose a method', 'Bank transfer')
    await choose('Make a payment with', 'Choose a method', 'Peanut card')
    mockSets = { ...LOCAL_RESIDENCE_RESTRICTION_SETS, full: new Set(['PT']) }
    view.rerender(ui('PT'))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('/')
    expect(screen.getByRole('button', { name: 'Looks good', hidden: true })).toBeDisabled()
    expect(screen.getByText('Bank transfers and card issuing aren’t available in your country.')).toBeInTheDocument()
})
it('can continue with explicitly selected universal channels when the restriction lookup fails', async () => {
    mockSettled = false
    renderWithIntl(ui('PT'))
    await choose('Add money with', 'Choose a method', 'Crypto')
    await choose('Make a payment with', 'Choose a method', 'Peanut-to-Peanut payments')
    fireEvent.click(screen.getByRole('button', { name: 'Looks good', hidden: true }))
    expect(next).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/peanut')
})
it('never picks Crypto automatically for payment in a preselected presentation', () => {
    renderWithIntl(ui('UA', true))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/peanut')
    expect(screen.getByText('The Peanut card isn’t available in your country.')).toBeInTheDocument()
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
