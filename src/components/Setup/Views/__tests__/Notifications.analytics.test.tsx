/** @jest-environment jsdom */
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'
import { setAuthToken } from '@/utils/auth-token'
import { SetupFlowProvider } from '@/features/setup/SetupFlowContext'
import { SignupScreenContext } from '@/features/setup/useSignupControl'
import NotificationsStep from '../Notifications'

const mockNext = jest.fn()
const mockSave = jest.fn()
const mockPermission = jest.fn()
const mockCapture = jest.fn()
let mockVariant: 'control' | 'switches' | 'defaults_on' = 'switches'
let queryClient: QueryClient
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext }) }))
jest.mock('@/services/notifications', () => ({
    ...jest.requireActual('@/services/notifications'),
    notificationsApi: { savePreferences: (...args: unknown[]) => mockSave(...args) },
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
jest.mock('@/features/setup/notificationsExperiment', () => ({
    ...jest.requireActual('@/features/setup/notificationsExperiment'),
    readNotificationsVariant: () => mockVariant,
}))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        permissionState: 'default',
        requestPermission: mockPermission,
        afterPermissionAttempt: async () => {},
        oneSignalInitialized: true,
    }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'new-user', email: 'private@example.com' } }, fetchUser: jest.fn() }),
    useOptionalAuth: () => ({ user: { user: { userId: 'new-user', email: 'private@example.com' } } }),
}))
jest.mock('@/components/Setup/Setup.consts', () => ({
    setupScreenIds: ['notification-email', 'notification-permission'],
}))
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))

const tree = () => (
    <QueryClientProvider client={queryClient}>
        <SetupFlowProvider masterScreenIds={['notification-email', 'notification-permission']}>
            <SignupScreenContext.Provider value="notification-permission">
                <NotificationsStep />
            </SignupScreenContext.Provider>
        </SetupFlowProvider>
    </QueryClientProvider>
)
const renderStep = () => renderWithIntl(tree())
const toggle = (name: string) => screen.getByRole('switch', { name })
const continueButton = () => screen.getByRole('button', { name: 'Continue' })
const controls = () =>
    mockCapture.mock.calls.filter(([event]) => event === 'control_used').map(([, payload]) => payload)
const errors = () => controls().filter(({ action }) => action === 'error')
const event = (control: string, action: string, value?: string) => ({
    flow: 'signup',
    screen_id: 'notification-permission',
    setup_host: 'signup',
    flow_version: 2,
    signup_entry_flow: 'default',
    control,
    action,
    ...(value === undefined ? {} : { value }),
})

beforeEach(() => {
    jest.clearAllMocks()
    mockVariant = 'switches'
    mockSave.mockReset().mockResolvedValue(undefined)
    mockPermission.mockReset().mockResolvedValue('granted')
    mockNext.mockReset().mockResolvedValue(undefined)
    setAuthToken(`x.${btoa(JSON.stringify({ userId: 'new-user' }))}.y`)
    queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
})

it.each(['control', 'switches', 'defaults_on'] as const)(
    'does not report %s defaults as user interactions',
    (variant) => {
        mockVariant = variant
        renderStep()
        expect(controls()).toEqual([])
    }
)

it('reports control push on and off exactly once each, with common context', async () => {
    mockVariant = 'control'
    renderStep()
    fireEvent.click(toggle('Push notifications'))
    await waitFor(() => expect(toggle('Push notifications')).toHaveAttribute('aria-checked', 'true'))
    await waitFor(() => expect(toggle('Push notifications')).toBeEnabled())
    fireEvent.click(toggle('Push notifications'))
    await waitFor(() => expect(controls()).toEqual([event('push', 'toggle', 'on'), event('push', 'toggle', 'off')]))
})

it.each(['switches', 'defaults_on'] as const)(
    'reports all explicit %s toggles without reporting automatic changes',
    (variant) => {
        mockVariant = variant
        renderStep()
        const firstPush = variant === 'defaults_on' ? 'off' : 'on'
        fireEvent.click(toggle('Important alerts'))
        expect(controls()).toEqual([event('push', 'toggle', firstPush)])
        fireEvent.click(toggle('Important alerts'))
        fireEvent.click(toggle('Offers and perks'))
        fireEvent.click(toggle('Offers and perks'))
        // Email is on initially or due to the first Important alerts cascade.
        fireEvent.click(toggle('Email updates'))
        fireEvent.click(toggle('Email updates'))
        expect(controls()).toEqual([
            event('push', 'toggle', firstPush),
            event('push', 'toggle', firstPush === 'on' ? 'off' : 'on'),
            event('marketing_push', 'toggle', 'on'),
            event('marketing_push', 'toggle', 'off'),
            event('email_updates', 'toggle', 'off'),
            event('email_updates', 'toggle', 'on'),
        ])
    }
)

it.each(['control', 'switches', 'defaults_on'] as const)(
    'reports %s Continue once without a value',
    async (variant) => {
        mockVariant = variant
        renderStep()
        if (variant === 'switches') fireEvent.click(toggle('Email updates'))
        fireEvent.click(continueButton())
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(controls().filter(({ action }) => action === 'tap')).toEqual([event('continue', 'tap')])
    }
)

it.each(['switches', 'defaults_on'] as const)('reports %s Not now and preserves opt-out saving', async (variant) => {
    mockVariant = variant
    renderStep()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(controls()).toEqual([event('not_now', 'tap')])
    expect(mockSave).toHaveBeenCalledWith({ push: false, marketingPush: false, emailUpdates: false }, 'new-user')
    expect(mockPermission).not.toHaveBeenCalled()
})

it.each([
    ['control', 'denied', 'denied'],
    ['control', 'default', 'dismissed'],
    ['switches', 'denied', 'denied'],
    ['switches', 'default', 'dismissed'],
    ['defaults_on', 'denied', 'denied'],
    ['defaults_on', 'default', 'dismissed'],
] as const)('reports %s permission %s safely, preserving the existing outcome', async (variant, answer, recorded) => {
    mockVariant = variant
    mockPermission.mockResolvedValueOnce(answer)
    renderStep()
    if (variant === 'control') fireEvent.click(toggle('Push notifications'))
    else {
        if (variant === 'switches') fireEvent.click(toggle('Important alerts'))
        fireEvent.click(continueButton())
    }
    await waitFor(() =>
        expect(mockCapture).toHaveBeenCalledWith('signup_push_permission_answered', { variant, answer: recorded })
    )
    expect(errors()).toEqual([event('push_permission', 'error', recorded)])
    expect(controls().filter(({ action }) => action === 'toggle')).toHaveLength(variant === 'defaults_on' ? 0 : 1)
})

it('reports a safe dismissed category when the permission SDK rejects', async () => {
    mockPermission.mockRejectedValueOnce(new Error('secret SDK diagnostic private@example.com'))
    renderStep()
    fireEvent.click(toggle('Important alerts'))
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(errors()).toEqual([event('push_permission', 'error', 'dismissed')])
    expect(JSON.stringify(controls())).not.toMatch(/secret|private@example.com/)
})

it('reports save failure once per attempt, suppresses rerenders, and reports a failed retry again', async () => {
    mockSave.mockRejectedValue(new Error('secret backend payload private@example.com'))
    const view = renderStep()
    fireEvent.click(toggle('Email updates'))
    fireEvent.click(continueButton())
    await screen.findByText('We couldn’t save your settings. Please try again.')
    expect(errors()).toEqual([event('notification_preferences', 'error', 'save_failed')])
    view.rerender(tree())
    view.rerender(tree())
    expect(errors()).toHaveLength(1)
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(errors()).toHaveLength(2))
    expect(errors()).toEqual([
        event('notification_preferences', 'error', 'save_failed'),
        event('notification_preferences', 'error', 'save_failed'),
    ])
    expect(JSON.stringify(controls())).not.toMatch(/secret|private@example.com|backend payload/)
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockCapture).not.toHaveBeenCalledWith('notification_choices_saved', expect.anything())
})

it('does not report a successful save after the initiating account changes', async () => {
    let finish!: () => void
    mockSave.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            finish = resolve
        })
    )
    renderStep()
    fireEvent.click(toggle('Email updates'))
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
    setAuthToken(`x.${btoa(JSON.stringify({ userId: 'another-user' }))}.y`)
    await act(async () => finish())
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockCapture).not.toHaveBeenCalledWith('notification_choices_saved', expect.anything())
    expect(controls()).toEqual([event('email_updates', 'toggle', 'on'), event('continue', 'tap')])
})

it('reports a control opt-out save failure and clears it for a successful retry', async () => {
    mockVariant = 'control'
    mockSave.mockRejectedValueOnce(new Error('private opt-out failure'))
    renderStep()
    fireEvent.click(toggle('Push notifications'))
    await waitFor(() => expect(toggle('Push notifications')).toHaveAttribute('aria-checked', 'true'))
    await waitFor(() => expect(toggle('Push notifications')).toBeEnabled())
    fireEvent.click(toggle('Push notifications'))
    await waitFor(() => expect(toggle('Push notifications')).toHaveAttribute('aria-checked', 'false'))
    fireEvent.click(continueButton())
    await screen.findByText('We couldn’t save your settings. Please try again.')
    expect(errors()).toEqual([event('notification_preferences', 'error', 'save_failed')])
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith({ push: false }, 'new-user')
    fireEvent.click(continueButton())
    await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
    expect(errors()).toHaveLength(1)
    expect(mockSave).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(controls())).not.toContain('private opt-out failure')
})

it.each(['granted', 'denied', 'default'] as const)(
    'suppresses a stale permission answer of %s after an account change',
    async (answer) => {
        let finish!: (answer: string) => void
        mockPermission.mockReturnValueOnce(
            new Promise<string>((resolve) => {
                finish = resolve
            })
        )
        renderStep()
        fireEvent.click(toggle('Important alerts'))
        fireEvent.click(continueButton())
        expect(mockPermission).toHaveBeenCalledTimes(1)
        setAuthToken(`x.${btoa(JSON.stringify({ userId: 'another-user' }))}.y`)
        await act(async () => finish(answer))
        expect(mockSave).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
        expect(mockCapture).not.toHaveBeenCalledWith('signup_push_permission_answered', expect.anything())
        expect(mockCapture).not.toHaveBeenCalledWith('notification_choices_saved', expect.anything())
        expect(errors()).toEqual([])
    }
)
