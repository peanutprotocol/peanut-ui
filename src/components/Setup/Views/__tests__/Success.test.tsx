import { StrictMode } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import SuccessStep from '../Success'

let mockCompleted = false
const mockRedirect = jest.fn()
const mockCelebrate = jest.fn()
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({ signupCompleted: mockCompleted }),
}))
jest.mock('@/hooks/useAccountSetup', () => ({ useAccountSetup: () => ({ handleRedirect: mockRedirect }) }))
jest.mock('@/utils/confetti', () => ({ confettiPresets: { celebration: () => mockCelebrate() } }))

beforeEach(() => {
    jest.clearAllMocks()
    mockCompleted = false
})
it('celebrates only a completed signup, once under StrictMode, and waits for the user to continue', () => {
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
    const button = screen.getByRole('button', { name: 'Go to account' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith({ isNewAccount: true })
})
