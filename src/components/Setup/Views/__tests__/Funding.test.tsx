import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import FundingStep from '../Funding'
import type { ResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { useEffect } from 'react'

const mockNext = jest.fn()
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext, isLoading: false }) }))
let mockSettled = true
let mockSets: ResidenceRestrictionSets | undefined
jest.mock('@/hooks/useResidenceRestrictionSets', () => {
    const actual = jest.requireActual('@/hooks/useResidenceRestrictionSets')
    return {
        ...actual,
        useResidenceRestrictionSetsWithStatus: () => ({
            sets: mockSets ?? actual.LOCAL_RESIDENCE_RESTRICTION_SETS,
            settled: mockSettled,
        }),
    }
})
beforeEach(() => {
    jest.clearAllMocks()
    mockSettled = true
    mockSets = undefined
})

function Country({ country = 'PT' }: { country?: string }) {
    const { setResidenceCountry, fundingMethods } = useSetupFlowContext()
    useEffect(() => setResidenceCountry(country), [country, setResidenceCountry])
    return <output aria-label="Selected funding methods">{fundingMethods.join(',')}</output>
}

function Reset() {
    const { resetSetupFlow } = useSetupFlowContext()
    return <button onClick={resetSetupFlow}>Reset signup</button>
}

it('starts unchecked, keeps multiple choices through remounts, and clears them for a fresh signup', () => {
    const view = renderWithIntl(
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
            <Country />
            <FundingStep />
            <Reset />
        </SetupFlowProvider>
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).not.toBeChecked())
    fireEvent.click(screen.getByLabelText('Bank transfer'))
    fireEvent.click(screen.getByLabelText('From someone on Peanut'))
    view.rerender(
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
            <Country />
            <Reset />
        </SetupFlowProvider>
    )
    view.rerender(
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
            <Country />
            <FundingStep />
            <Reset />
        </SetupFlowProvider>
    )
    expect(screen.getByLabelText('Bank transfer')).toBeChecked()
    expect(screen.getByLabelText('From someone on Peanut')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Bank transfer'))
    expect(screen.getByLabelText('Bank transfer')).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Reset signup' }))
    screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).not.toBeChecked())
    fireEvent.click(screen.getByRole('button', { name: 'Let’s keep going' }))
    expect(mockNext).toHaveBeenCalledTimes(1)
})

it.each(['UA', 'RU', 'GB', 'IN'])('hides bank and cash for a two-feature residence (%s)', (country) => {
    renderWithIntl(
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
            <Country country={country} />
            <FundingStep />
        </SetupFlowProvider>
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.queryByLabelText('Bank transfer')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cash')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Crypto')).not.toBeChecked()
    expect(screen.getByLabelText('From someone on Peanut')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText('Crypto'))
    fireEvent.click(screen.getByLabelText('From someone on Peanut'))
    expect(screen.getByLabelText('Selected funding methods')).toHaveTextContent('crypto,peanut')
    fireEvent.click(screen.getByRole('button', { name: 'Let’s keep going' }))
    expect(mockNext).toHaveBeenCalledTimes(1)
})

it.each(['PT', 'BR', 'JP'])('keeps all four methods when bank or card adds a feature (%s)', (country) => {
    renderWithIntl(
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
            <Country country={country} />
            <FundingStep />
        </SetupFlowProvider>
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(screen.getByLabelText('Bank transfer')).not.toBeChecked()
    expect(screen.getByLabelText('Cash')).not.toBeChecked()
})

it('removes hidden selections when residence changes and retains visible choices', () => {
    const ui = (country: string) => (
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
            <Country country={country} />
            <FundingStep />
        </SetupFlowProvider>
    )
    const view = renderWithIntl(ui('PT'))
    for (const label of ['Bank transfer', 'Cash', 'Crypto']) fireEvent.click(screen.getByLabelText(label))
    view.rerender(ui('UA'))
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByLabelText('Selected funding methods')).toHaveTextContent(/^crypto$/)
    view.rerender(ui('PT'))
    expect(screen.getByLabelText('Bank transfer')).not.toBeChecked()
    expect(screen.getByLabelText('Cash')).not.toBeChecked()
    expect(screen.getByLabelText('Crypto')).toBeChecked()
})

it('uses the two universal methods until server eligibility settles', () => {
    mockSettled = false
    const ui = () => (
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
            <Country />
            <FundingStep />
        </SetupFlowProvider>
    )
    const view = renderWithIntl(ui())
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    fireEvent.click(screen.getByLabelText('Crypto'))
    mockSettled = true
    view.rerender(ui())
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(screen.getByLabelText('Crypto')).toBeChecked()
})
