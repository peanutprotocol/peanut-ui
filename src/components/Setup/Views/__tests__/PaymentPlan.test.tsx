/** @jest-environment jsdom */
import { useEffect } from 'react'
import { fireEvent, screen, within, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import PaymentPlan from '../PaymentPlan'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'

let mockSets = LOCAL_RESIDENCE_RESTRICTION_SETS
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    ...jest.requireActual('@/hooks/useResidenceRestrictionSets'),
    useResidenceRestrictionSetsWithStatus: () => ({ sets: mockSets, settled: true }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
const next = jest.fn()
function Fixture({ country }: { country: string }) {
    const context = useSetupFlowContext()
    useEffect(() => {
        context.setResidenceCountry(country)
    }, [country, context.setResidenceCountry])
    return (
        <>
            <PaymentPlan onContinue={next} />
            <output aria-label="Plan">
                {context.fundingChannel}/{context.paymentChannel}
            </output>
        </>
    )
}
const ui = (country: string) => (
    <SetupFlowProvider masterScreenIds={['residence']}>
        <Fixture country={country} />
    </SetupFlowProvider>
)

beforeEach(() => {
    mockSets = LOCAL_RESIDENCE_RESTRICTION_SETS
    next.mockClear()
})

it('changes funding through the real drawer and keeps the choice after closing it', async () => {
    renderWithIntl(ui('PT'))
    fireEvent.click(screen.getByRole('button', { name: 'Add money with: EUR · SEPA' }))
    const drawer = screen.getByRole('dialog')
    expect(
        within(drawer)
            .getAllByRole('button')
            .map((row) => row.getAttribute('aria-label'))
    ).toEqual(['EUR · SEPA', 'GBP · Faster Payments', 'USD · ACH', 'Crypto', 'Peanut-to-Peanut payments'])
    expect(within(drawer).queryByText('Cash')).not.toBeInTheDocument()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Crypto' }))
    await waitFor(() => expect(drawer).toHaveAttribute('data-state', 'closed'))
    expect(screen.getByRole('button', { name: 'Add money with: Crypto', hidden: true })).toBeInTheDocument()
    expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/card')
    expect(next).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Looks good', hidden: true }))
    expect(next).toHaveBeenCalledTimes(1)
})

it('offers local QR payments instead of a card in Brazil and resets hidden choices after residence changes', () => {
    const view = renderWithIntl(ui('PT'))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('eurSepa/card')
    view.rerender(ui('BR'))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('pix/pix')
    fireEvent.click(screen.getByRole('button', { name: 'Make a payment with: Pix payments' }))
    const drawer = screen.getByRole('dialog')
    expect(within(drawer).queryByText('Peanut card')).not.toBeInTheDocument()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Peanut-to-Peanut payments' }))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('pix/peanut')
})

it('removes a selected bank channel if authoritative restrictions change', () => {
    const view = renderWithIntl(ui('PT'))
    mockSets = { ...LOCAL_RESIDENCE_RESTRICTION_SETS, full: new Set(['PT']) }
    view.rerender(ui('PT'))
    expect(screen.getByLabelText('Plan')).toHaveTextContent('crypto/peanut')
    expect(screen.queryByText('What this sets up')).not.toBeInTheDocument()
})
