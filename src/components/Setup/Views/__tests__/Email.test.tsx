/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import { SetupFlowProvider } from '@/features/setup/SetupFlowContext'
import EmailStep from '../Email'

const mockUpdateUser = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: jest.fn() }) }))
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUser(...args) }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('@/features/setup/report-email-save-failure', () => ({ reportEmailSaveFailure: jest.fn() }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'new-user', email: '' } }, fetchUser: jest.fn(async () => {}) }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

it('reports the email field edit once, each failed Continue with its reason, and never the address', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: 'This email is already associated with another account' })
    renderWithIntl(
        <QueryClientProvider client={new QueryClient()}>
            <SetupFlowProvider masterScreenIds={['notification-email']}>
                {onSignupScreen('notification-email', <EmailStep />)}
            </SetupFlowProvider>
        </QueryClientProvider>
    )
    const input = screen.getByRole('textbox', { name: 'Email address' })
    fireEvent.change(input, { target: { value: 'wrong' } })
    fireEvent.change(input, { target: { value: 'wrong2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.change(input, { target: { value: 'taken@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('The user with this email was already registered.')
    const capture = posthog.capture as jest.Mock
    expect(signupControls(capture)).toEqual([
        'email:change',
        'continue:tap',
        'email:error:invalid',
        'continue:tap',
        'email:error:already_registered',
    ])
    expect(capture.mock.calls[0][1]).toEqual(expect.objectContaining({ screen_id: 'notification-email' }))
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/example\.com|wrong/)
})
