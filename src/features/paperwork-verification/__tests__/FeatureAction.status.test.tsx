import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { KycFeatureActivationStatus } from '../KycFeatureActivationStatus'

let mockError: string | null = null
const mockStart = jest.fn()
jest.mock('@/hooks/useSumsubKycFlow', () => ({
    useSumsubKycFlow: () => ({
        handleStartAction: mockStart,
        handleClose: jest.fn(),
        showWrapper: false,
        isLoading: false,
        error: mockError,
    }),
}))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose }: { pose: string }) => <div data-testid="mascot" data-pose={pose} />,
}))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))

beforeEach(() => {
    mockError = null
    mockStart.mockClear()
})

it.each([
    [null, 'yellow'],
    ['SDK start failed', 'red'],
] as const)('shows the appropriate status for SDK error %s', (error, color) => {
    mockError = error
    const onBack = jest.fn()
    const onRetry = jest.fn()
    const { container } = renderWithIntl(
        <KycFeatureActivationStatus
            feature="local"
            result={{ kind: 'report', report: { state: 'action_required', action: 'supplement:manteca' } }}
            isLoading={false}
            onRetry={onRetry}
            onBack={onBack}
        />
    )

    expect(container.querySelector(`.bg-background-icon-bubble-${color}`)).toBeInTheDocument()
    expect(container.querySelector('.bg-background-icon-bubble-green')).not.toBeInTheDocument()
    expect(screen.getByTestId('mascot')).toHaveAttribute('data-pose', 'thinking')
    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('verify-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(mockStart).toHaveBeenCalledTimes(2)
    expect(onRetry).not.toHaveBeenCalled()
})
