import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import FundingStep from '../Funding'

const mockNext = jest.fn()
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext, isLoading: false }) }))

function Reset() {
    const { resetSetupFlow } = useSetupFlowContext()
    return <button onClick={resetSetupFlow}>Reset signup</button>
}

it('starts unchecked, keeps multiple choices through remounts, and clears them for a fresh signup', () => {
    const view = renderWithIntl(
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
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
            <Reset />
        </SetupFlowProvider>
    )
    view.rerender(
        <SetupFlowProvider masterScreenIds={['funding-methods']}>
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(mockNext).toHaveBeenCalledTimes(1)
})
