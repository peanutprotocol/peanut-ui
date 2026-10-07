import { StrictMode } from 'react'
import { act, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import SuccessStep from '../Success'
import { disableDemoMode, enableDemoMode } from '@/utils/demo'

let mockCompleted = false
const mockRedirect = jest.fn()
const mockReplace = jest.fn()
const mockRouter = { replace: mockReplace }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
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
jest.mock('../../components/CelebrationCurtain', () => ({
    __esModule: true,
    default: () => <canvas data-testid="celebration-curtain" />,
}))

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockCompleted = false
    disableDemoMode()
})
afterEach(() => {
    jest.useRealTimers()
    disableDemoMode()
})
it('celebrates and haptics once, then enters the account after 4.5 seconds', () => {
    const view = renderWithIntl(
        <StrictMode>
            <SuccessStep />
        </StrictMode>
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('celebration-curtain')).not.toBeInTheDocument()
    mockCompleted = true
    view.rerender(
        <StrictMode>
            <SuccessStep />
        </StrictMode>
    )
    expect(screen.getByTestId('celebration-curtain')).toBeInTheDocument()
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(mockHaptic).toHaveBeenCalledTimes(1)
    expect(mockHaptic).toHaveBeenCalledWith('success')
    act(() => jest.advanceTimersByTime(4499))
    expect(mockRedirect).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith({ isNewAccount: true })
})

it('sends a demo celebration to home instead of consuming a signup deep link', () => {
    enableDemoMode()
    mockCompleted = true
    renderWithIntl(<SuccessStep />)
    expect(screen.getByTestId('celebration-mascot')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(4500))
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/home')
    expect(mockRedirect).not.toHaveBeenCalled()
})
