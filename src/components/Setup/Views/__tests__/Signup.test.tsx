/** @jest-environment jsdom */
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { USER } from '@/constants/query.consts'
import { DEMO_USER } from '@/constants/demo-data'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import SignupStep from '../Signup'

const mockSetScreenId = jest.fn()
const mockApiFetch = jest.fn()
const mockClaim = jest.fn(async () => {})
const mockPasskey = {
    claim: mockClaim,
    isClaiming: false,
    preflightWarning: null as string | null,
    inlineError: null as string | null,
    usernameTaken: false,
    logIn: jest.fn(),
    isLoggingIn: false,
    helpErrorName: null as string | null,
    isHelpOpen: false,
    closeHelp: jest.fn(),
    retryFromHelp: jest.fn(),
    deviceType: 'web',
}
const mockUseSignupPasskey = jest.fn((_username: string) => mockPasskey)

jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ isLoading: false, setScreenId: mockSetScreenId }),
}))
// the passkey ceremony has its own suite (useSignupPasskey.test.tsx); this one owns the step's UI
jest.mock('@/features/setup/useSignupPasskey', () => ({
    useSignupPasskey: (username: string) => mockUseSignupPasskey(username),
}))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))

function FlowState() {
    const { signupCompleted, residenceCountry, noBackLockScreenId } = useSetupFlowContext()
    return (
        <output data-testid="flow-state">
            {JSON.stringify({ signupCompleted, residenceCountry, noBackLockScreenId })}
        </output>
    )
}

const renderSignup = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = renderWithIntl(
        <QueryClientProvider client={queryClient}>
            <SetupFlowProvider masterScreenIds={setupScreenIds}>
                <SignupStep />
                <FlowState />
            </SetupFlowProvider>
        </QueryClientProvider>
    )
    return { ...view, queryClient }
}
const claimButton = () => screen.getByRole('button', { name: 'Claim' })
const usernameField = () => screen.getByRole('textbox', { name: 'Username' })

beforeEach(() => {
    jest.clearAllMocks()
    disableDemoMode()
    Object.assign(mockPasskey, {
        isClaiming: false,
        preflightWarning: null,
        inlineError: null,
        usernameTaken: false,
        isLoggingIn: false,
        helpErrorName: null,
        isHelpOpen: false,
    })
    mockApiFetch.mockResolvedValue({ status: 404 })
})
afterEach(() => disableDemoMode())

describe('Claim username', () => {
    it('claims a valid, available username by starting the passkey sign-up', async () => {
        renderSignup()
        expect(claimButton()).toBeDisabled()
        fireEvent.change(usernameField(), { target: { value: 'newuser' } })
        await waitFor(() => expect(claimButton()).toBeEnabled())
        expect(mockApiFetch).toHaveBeenCalledWith('/users/username/newuser', expect.any(Object))
        expect(mockUseSignupPasskey).toHaveBeenLastCalledWith('newuser')
        fireEvent.click(claimButton())
        await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1))
        expect(mockSetScreenId).not.toHaveBeenCalled()
    })

    it('shows the username rules before any error, and an error in their place', async () => {
        renderSignup()
        const rules = '4–12 characters. Start with a letter. Letters and numbers only.'
        expect(screen.getByText(rules)).toBeInTheDocument()
        fireEvent.change(usernameField(), { target: { value: 'abc' } })
        expect(await screen.findByText('Use at least 4 characters.')).toBeInTheDocument()
        expect(screen.queryByText(rules)).not.toBeInTheDocument()
        expect(mockApiFetch).not.toHaveBeenCalled()
        expect(claimButton()).toBeDisabled()
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_USERNAME_INVALID, {
            error_type: 'too_short',
            username: 'abc',
        })
    })

    it.each([
        ['waytoolongname', 'Use 12 characters or fewer.', 'too_long'],
        ['1abc', 'Start with a letter. Use only letters and numbers.', 'format'],
        ['ab.cd', 'Start with a letter. Use only letters and numbers.', 'format'],
    ])('explains %s against the same rules and records why', async (value, message, errorType) => {
        renderSignup()
        fireEvent.change(usernameField(), { target: { value } })
        expect(await screen.findByText(message)).toBeInTheDocument()
        expect(mockApiFetch).not.toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_USERNAME_INVALID, {
            error_type: errorType,
            username: value,
        })
    })

    it('keeps Claim disabled for a taken username', async () => {
        mockApiFetch.mockResolvedValue({ status: 200 })
        renderSignup()
        fireEvent.change(usernameField(), { target: { value: 'takenname' } })
        expect(await screen.findByText('Username already taken')).toBeInTheDocument()
        expect(claimButton()).toBeDisabled()
        fireEvent.click(claimButton())
        expect(mockClaim).not.toHaveBeenCalled()
    })

    it('shows the @ prefix, the role placeholder and the legal line under the pinned button, with no inviter UI', () => {
        renderSignup()
        expect(usernameField()).toHaveAttribute('placeholder', 'batman')
        expect(screen.getByText('@')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Who invited you?' })).not.toBeInTheDocument()
        expect(screen.queryByText(/Invited by/)).not.toBeInTheDocument()
        const legal = screen.getByText(/By creating an account, you agree to the/)
        expect(screen.getByRole('link', { name: 'T&C' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument()
        // the legal line takes the slot under the primary, so the primary sits where every step has it
        expect(claimButton().compareDocumentPosition(legal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(legal.closest('[data-setup-footer]')).toContainElement(claimButton())
    })

    it('stays disabled while the passkey sign-up runs', async () => {
        mockPasskey.isClaiming = true
        renderSignup()
        fireEvent.change(usernameField(), { target: { value: 'newuser' } })
        await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
        expect(screen.getAllByRole('button').find((b) => b.closest('[data-setup-footer]'))).toBeDisabled()
    })

    it('offers Log in when the username is already registered', () => {
        mockPasskey.usernameTaken = true
        renderSignup()
        expect(screen.getByText(/This username is already registered/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(mockPasskey.logIn).toHaveBeenCalledTimes(1)
    })

    it('shows the passkey failure message on the step', () => {
        mockPasskey.inlineError = 'Passkey verification wasn’t completed. Try again when ready.'
        renderSignup()
        expect(screen.getByText('Passkey verification wasn’t completed. Try again when ready.')).toBeInTheDocument()
    })

    it('suggests ten handles after four idle seconds, then restores the placeholder', () => {
        jest.useFakeTimers()
        try {
            renderSignup()
            const username = usernameField()
            act(() => jest.advanceTimersByTime(3999))
            expect(screen.queryByText('batman?')).not.toBeInTheDocument()
            act(() => jest.advanceTimersByTime(1))
            expect(screen.getByText('batman?')).toBeInTheDocument()
            for (let idea = 1; idea < 10; idea++) {
                act(() => jest.advanceTimersByTime(2000))
            }
            expect(screen.getByText('peanutpirate?')).toBeInTheDocument()
            act(() => jest.advanceTimersByTime(2000))
            expect(username).toHaveAttribute('placeholder', 'batman')
        } finally {
            jest.useRealTimers()
        }
    })

    it('stops handle suggestions when the username field receives focus', () => {
        jest.useFakeTimers()
        try {
            renderSignup()
            fireEvent.focus(usernameField())
            act(() => jest.advanceTimersByTime(24000))
            expect(screen.queryByText('batman?')).not.toBeInTheDocument()
        } finally {
            jest.useRealTimers()
        }
    })

    it.each(['demo', 'DEMO', ' Demo '])(
        'submits username %s into the demo celebration without an availability call or a passkey',
        async (code) => {
            const { queryClient } = renderSignup()
            let userRequestAborted = false
            void queryClient
                .fetchQuery({
                    queryKey: [USER],
                    queryFn: ({ signal }) =>
                        new Promise((resolve) => {
                            signal.addEventListener('abort', () => {
                                userRequestAborted = true
                                resolve(null)
                            })
                        }),
                })
                .catch(() => {})
            fireEvent.change(usernameField(), { target: { value: code } })
            await waitFor(() => expect(claimButton()).toBeEnabled())
            expect(isDemoMode()).toBe(false)
            fireEvent.click(claimButton())
            await waitFor(() => expect(mockSetScreenId).toHaveBeenCalledWith('advantage-control'))
            expect(isDemoMode()).toBe(true)
            expect(userRequestAborted).toBe(true)
            expect(queryClient.getQueryData([USER])).toEqual(DEMO_USER)
            expect(screen.getByTestId('flow-state')).toHaveTextContent(
                JSON.stringify({
                    signupCompleted: true,
                    residenceCountry: 'BR',
                    noBackLockScreenId: 'advantage-control',
                })
            )
            expect(mockApiFetch).not.toHaveBeenCalled()
            expect(mockClaim).not.toHaveBeenCalled()
        }
    )

    it('does not activate demo mode merely by typing the username', async () => {
        const { unmount } = renderSignup()
        fireEvent.change(usernameField(), { target: { value: 'demo' } })
        await waitFor(() => expect(claimButton()).toBeEnabled())
        unmount()
        expect(isDemoMode()).toBe(false)
        expect(mockSetScreenId).not.toHaveBeenCalled()
        expect(mockApiFetch).not.toHaveBeenCalled()
    })

    it('checks similar usernames normally and does not activate demo mode', async () => {
        renderSignup()
        fireEvent.change(usernameField(), { target: { value: 'demouser' } })
        await waitFor(() => expect(claimButton()).toBeEnabled())
        expect(mockApiFetch).toHaveBeenCalledWith('/users/username/demouser', expect.any(Object))
        fireEvent.click(claimButton())
        await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1))
        expect(isDemoMode()).toBe(false)
        expect(mockSetScreenId).not.toHaveBeenCalled()
    })
})
