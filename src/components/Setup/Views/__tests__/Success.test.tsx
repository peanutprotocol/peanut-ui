import { StrictMode } from 'react'
import { act, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import SuccessStep from '../Success'

let mockCompleted = false
const mockRedirect = jest.fn()
const mockCelebrate = jest.fn()
const mockHaptic = jest.fn()
jest.mock('@/utils/haptics', () => ({ notifyHaptic: (...args: unknown[]) => mockHaptic(...args) }))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({ signupCompleted: mockCompleted }),
}))
jest.mock('@/hooks/useAccountSetup', () => ({ useAccountSetup: () => ({ handleRedirect: mockRedirect }) }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <div data-testid="celebration-mascot" />,
}))
jest.mock('@/utils/confetti', () => ({ confettiPresets: { celebration: () => mockCelebrate() } }))

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockCompleted = false
})
afterEach(() => jest.useRealTimers())
it('celebrates and haptics once, then enters the account after five seconds', () => {
    const view = renderWithIntl(
        <StrictMode>
            <SuccessStep />
        </StrictMode>
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(mockCelebrate).not.toHaveBeenCalled()
    mockCompleted = true
    view.rerender(
        <StrictMode>
            <SuccessStep />
        </StrictMode>
    )
    expect(mockCelebrate).toHaveBeenCalledTimes(1)
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(mockHaptic).toHaveBeenCalledTimes(1)
    expect(mockHaptic).toHaveBeenCalledWith('success')
    act(() => jest.advanceTimersByTime(4999))
    expect(mockRedirect).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith({ isNewAccount: true })
})
