/** @jest-environment jsdom */
/**
 * 10 Notifications (`notification-permission`), contract P4 § 3. The control arm is the drawn one-button form
 * ("Turn on notifications" + "Not now") with dev's outcomes; the switch arms keep dev's behaviour; "Open
 * settings" shows only where canOpenAppSettings() is true. The arm comes from the real readNotificationsVariant
 * reading PostHog's flag. Ports dev's NotificationSetup.test.tsx and Notifications.analytics.test.tsx.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { NotificationChoices } from '@/features/setup/SetupFlowContext'
import { NOTIFICATIONS_EXPERIMENT_FLAG } from '@/features/setup/notificationsExperiment'
import { signupControls } from '@/test-utils/signup-controls'
import { setAuthToken } from '@/utils/auth-token'
import { canOpenAppSettings, openAppSettings } from '@/utils/native-settings'
import { NotificationsScreen } from '../NotificationsScreen'
import {
    copy,
    copyRx,
    footer,
    renderRedesign,
    setupState,
    tagCopy,
    textMatch,
    textRx,
    type FlowSeed,
} from '../../Accounts/__tests__/redesignHarness'

const mockNext = jest.fn()
const mockSave = jest.fn()
const mockPermission = jest.fn()
const mockAfterPermission = jest.fn(async () => {})
let mockFlag: string | undefined
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell())
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: () => ({ addEventListener: jest.fn(), destroy: jest.fn(), goToAndStop: jest.fn() }) },
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext, isLoading: false }) }))
jest.mock('@/services/notifications', () => ({
    ...jest.requireActual('@/services/notifications'),
    notificationsApi: { savePreferences: (...args: unknown[]) => mockSave(...args) },
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: jest.fn(),
        setPersonProperties: jest.fn(),
        getFeatureFlag: jest.fn(() => mockFlag),
        featureFlags: { hasLoadedFlags: true },
    },
}))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        permissionState: 'default',
        requestPermission: mockPermission,
        afterPermissionAttempt: mockAfterPermission,
        oneSignalInitialized: true,
    }),
}))
jest.mock('@/utils/native-settings', () => ({
    canOpenAppSettings: jest.fn(() => false),
    openAppSettings: jest.fn(async () => true),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'new-user', email: 'private@mail.com' } }, fetchUser: jest.fn() }),
    useOptionalAuth: () => ({ user: { user: { userId: 'new-user', email: 'private@mail.com' } } }),
}))
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))

const capture = posthog.capture as jest.Mock
const controls = () => signupControls(capture)
let queryClient: QueryClient

const render = (seed: FlowSeed = {}, opts: { showBackButton?: boolean; onBack?: () => void } = {}) =>
    renderRedesign(
        <QueryClientProvider client={queryClient}>
            <NotificationsScreen />
        </QueryClientProvider>,
        { screenId: 'notification-permission', seed, ...opts }
    )

const foot = (container: HTMLElement) => within(footer(container)!)
const turnOn = (c: HTMLElement) => foot(c).getByRole('button', { name: copyRx('setupRedesign.notif.cta') })
const notNow = (c: HTMLElement) => foot(c).getByRole('button', { name: copyRx('setupRedesign.common.notNow') })
const continueButton = (c: HTMLElement) =>
    foot(c).getByRole('button', { name: copyRx('setupRedesign.common.continue') })
const primary = (c: HTMLElement) => foot(c).getAllByRole('button')[0]
const important = () => screen.getByRole('switch', { name: copyRx('setup.notifications.importantLabel') })
const offers = () => screen.getByRole('switch', { name: copyRx('setup.notifications.offersLabel') })
const emailUpdates = () => screen.getByRole('switch', { name: copyRx('setup.notifications.emailLabel') })
const switchStates = () => [important(), offers(), emailUpdates()].map((s) => s.getAttribute('aria-checked'))
const answered = () =>
    capture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_PUSH_PERMISSION_ANSWERED).map(([, p]) => p)
const deniedNote = () => screen.queryByText(textMatch(copy('setupRedesign.notif.denied')))
const openSettingsText = () => tagCopy('setupRedesign.notif.openSettings', 'link')
const otherAccount = () => setAuthToken(`x.${btoa(JSON.stringify({ userId: 'another-user' }))}.y`)

beforeEach(() => {
    jest.clearAllMocks()
    setAuthToken(`x.${btoa(JSON.stringify({ userId: 'new-user' }))}.y`)
    mockFlag = undefined
    mockNext.mockReset().mockResolvedValue(undefined)
    mockSave.mockReset().mockResolvedValue(undefined)
    mockPermission.mockReset().mockResolvedValue('granted')
    mockAfterPermission.mockReset().mockResolvedValue(undefined)
    jest.mocked(canOpenAppSettings).mockReturnValue(false)
    queryClient = new QueryClient()
})

describe('10 Notifications: shared', () => {
    it('P4-02 the back button renders on 10 and goes back', () => {
        const onBack = jest.fn()
        render({}, { showBackButton: true, onBack })
        fireEvent.click(screen.getByRole('button', { name: copyRx('setup.navigation.goBack') }))
        expect(onBack).toHaveBeenCalledTimes(1)
        expect(controls()).toContain('back:tap')
    })

    it('P4-17 reads the arm once per mount: a flag that changes later does not change the screen', () => {
        mockFlag = 'switches'
        const view = render()
        expect(screen.getAllByRole('switch')).toHaveLength(3)
        mockFlag = 'control'
        view.rerenderSame()
        expect(screen.getAllByRole('switch')).toHaveLength(3)
        const reads = (posthog.getFeatureFlag as jest.Mock).mock.calls.filter(
            ([f]) => f === NOTIFICATIONS_EXPERIMENT_FLAG
        )
        expect(reads).toHaveLength(1)
    })

    it.each([undefined, 'control', 'something-else'])('P4-17 flag %p shows the control arm', (flag) => {
        mockFlag = flag
        const { container } = render()
        expect(turnOn(container)).toBeInTheDocument()
        expect(screen.queryAllByRole('switch')).toHaveLength(0)
    })
})

describe('10 Notifications: control arm', () => {
    it('P4-18 title, "Turn on notifications", "Not now", and no switch rows', () => {
        const { container } = render()
        expect(screen.getByTestId('setup-redesign-notifications')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx('setupRedesign.notif.title'))
        expect(screen.getByText(textMatch(copy('setupRedesign.notif.desc')))).toBeInTheDocument()
        expect(primary(container)).toHaveAccessibleName(copyRx('setupRedesign.notif.cta'))
        expect(notNow(container)).toBeEnabled()
        expect(screen.queryAllByRole('switch')).toHaveLength(0)
        expect(setupState(container)).toBe('default')
    })

    it('P4-19 "Turn on" asks the OS inside the tap, reports push:toggle:on, and the primary spins until the answer', async () => {
        let answer!: (permission: string) => void
        mockPermission.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
        const { container } = render()
        fireEvent.click(turnOn(container))
        // same task: no await between the tap and the request
        expect(mockPermission).toHaveBeenCalledTimes(1)
        expect(controls()).toContain('push:toggle:on')
        await waitFor(() => expect(setupState(container)).toBe('prompt'))
        expect(primary(container)).toBeDisabled()
        expect(within(primary(container)).getByRole('status')).toBeInTheDocument()
        expect(notNow(container)).toBeDisabled()
        await act(async () => answer('denied'))
        await waitFor(() => expect(setupState(container)).toBe('denied'))
    })

    it('P4-20 granted: saves exactly the push grant, then advances; the answer is recorded', async () => {
        const view = render()
        fireEvent.click(turnOn(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).toHaveBeenCalledTimes(1)
        expect(mockSave.mock.calls[0][0]).toStrictEqual({ push: true, pushPermission: 'granted' })
        expect(mockSave.mock.calls[0][1]).toBe('new-user')
        expect(answered()).toEqual([{ variant: 'control', answer: 'granted' }])
        expect(view.flow().notificationChoices.push).toBe(true)
        // save first, then navigation
        expect(mockSave.mock.invocationCallOrder[0]).toBeLessThan(mockNext.mock.invocationCallOrder[0])
    })

    it('P4-21 granted but the save fails: still advances, reports save_failed, shows no callout', async () => {
        mockSave.mockRejectedValueOnce(new Error('network'))
        const { container } = render()
        fireEvent.click(turnOn(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(controls()).toContain('notification_preferences:error:save_failed')
        expect(screen.queryByText(textMatch(copy('setup.notifications.saveFailed')))).not.toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('P4-22 "Not now" asks nothing, saves nothing, advances once', async () => {
        const view = render()
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockPermission).not.toHaveBeenCalled()
        expect(mockSave).not.toHaveBeenCalled()
        expect(controls()).toEqual(['not_now:tap'])
        expect(view.flow().notificationChoices.push).toBe(false)
    })

    it('P4-23 a thrown request: back to default, no callout, recorded as dismissed, push off', async () => {
        mockPermission.mockRejectedValueOnce(new Error('sdk'))
        const view = render()
        fireEvent.click(turnOn(view.container))
        await waitFor(() => expect(answered()).toEqual([{ variant: 'control', answer: 'dismissed' }]))
        await waitFor(() => expect(setupState(view.container)).toBe('default'))
        expect(controls()).toContain('push_permission:error:dismissed')
        expect(deniedNote()).not.toBeInTheDocument()
        expect(view.flow().notificationChoices.push).toBe(false)
        expect(turnOn(view.container)).toBeEnabled()
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('P4-24 an OS dismissal ("default") returns to default and a second "Turn on" asks again', async () => {
        mockPermission.mockResolvedValueOnce('default')
        const view = render()
        fireEvent.click(turnOn(view.container))
        await waitFor(() => expect(answered()).toEqual([{ variant: 'control', answer: 'dismissed' }]))
        await waitFor(() => expect(setupState(view.container)).toBe('default'))
        expect(deniedNote()).not.toBeInTheDocument()
        expect(view.flow().notificationChoices.push).toBe(false)
        fireEvent.click(turnOn(view.container))
        expect(mockPermission).toHaveBeenCalledTimes(2)
    })

    it('P4-25 denied: denied state, info callout, Continue as primary, push off; Continue asks no more', async () => {
        mockPermission.mockResolvedValueOnce('denied')
        const view = render()
        fireEvent.click(turnOn(view.container))
        await waitFor(() => expect(setupState(view.container)).toBe('denied'))
        expect(deniedNote()).toBeInTheDocument()
        expect(primary(view.container)).toHaveAccessibleName(copyRx('setupRedesign.common.continue'))
        expect(view.flow().notificationChoices.push).toBe(false)
        expect(controls()).toContain('push_permission:error:denied')
        expect(answered()).toEqual([{ variant: 'control', answer: 'denied' }])
        fireEvent.click(continueButton(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockPermission).toHaveBeenCalledTimes(1)
    })

    it('P4-26 denied with app settings available: "Open settings" opens them once and the step stays', async () => {
        jest.mocked(canOpenAppSettings).mockReturnValue(true)
        mockPermission.mockResolvedValueOnce('denied')
        const { container } = render()
        fireEvent.click(turnOn(container))
        await waitFor(() => expect(setupState(container)).toBe('denied'))
        const link = foot(container).getByText(textRx(openSettingsText())).closest('a,button') as HTMLElement
        fireEvent.click(link)
        await waitFor(() => expect(openAppSettings).toHaveBeenCalledTimes(1))
        expect(controls()).toContain('open_settings:tap')
        expect(setupState(container)).toBe('denied')
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('P4-26 denied without app settings: no "Open settings"', async () => {
        mockPermission.mockResolvedValueOnce('denied')
        const { container } = render()
        fireEvent.click(turnOn(container))
        await waitFor(() => expect(setupState(container)).toBe('denied'))
        expect(screen.queryByText(textMatch(openSettingsText()))).not.toBeInTheDocument()
    })

    it('P4-27 denied Continue saves nothing and advances once', async () => {
        mockPermission.mockResolvedValueOnce('denied')
        const { container } = render()
        fireEvent.click(turnOn(container))
        await waitFor(() => expect(setupState(container)).toBe('denied'))
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).not.toHaveBeenCalled()
        expect(controls()).toEqual(['push:toggle:on', 'push_permission:error:denied', 'continue:tap'])
    })

    it('P4-18 control never writes marketingPush or emailUpdates', async () => {
        const { container } = render()
        fireEvent.click(turnOn(container))
        await waitFor(() => expect(mockSave).toHaveBeenCalled())
        for (const [body] of mockSave.mock.calls) {
            expect(body).not.toHaveProperty('marketingPush')
            expect(body).not.toHaveProperty('emailUpdates')
        }
    })
})

describe('10 Notifications: switches arm', () => {
    beforeEach(() => {
        mockFlag = 'switches'
    })

    it('P4-28 three rows all off, Continue off, "Not now" shown; Important on brings Email updates once, never Offers', () => {
        const { container } = render()
        expect(setupState(container)).toBe('switches')
        expect(switchStates()).toEqual(['false', 'false', 'false'])
        expect(continueButton(container)).toBeDisabled()
        expect(notNow(container)).toBeEnabled()
        expect(screen.getByText(textMatch(copy('setup.notifications.changeAnytime')))).toBeInTheDocument()
        fireEvent.click(important())
        expect(switchStates()).toEqual(['true', 'false', 'true'])
        expect(continueButton(container)).toBeEnabled()
        fireEvent.click(emailUpdates())
        fireEvent.click(important())
        fireEvent.click(important())
        // cascades once only
        expect(switchStates()).toEqual(['true', 'false', 'false'])
        expect(controls()).toEqual(['push:toggle:on', 'email_updates:toggle:off', 'push:toggle:off', 'push:toggle:on'])
    })

    it('P4-30 Email updates alone saves without asking the OS', async () => {
        const view = render()
        fireEvent.click(emailUpdates())
        fireEvent.click(continueButton(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockPermission).not.toHaveBeenCalled()
        expect(mockSave).toHaveBeenCalledWith({ push: false, marketingPush: false, emailUpdates: true }, 'new-user')
        expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.NOTIFICATION_CHOICES_SAVED, {
            variant: 'switches',
            outcome: 'not_asked',
            important: false,
            offers: false,
            email: true,
        })
    })

    it.each([
        ['granted', { push: true, marketingPush: true }],
        ['denied', { push: false, marketingPush: false }],
    ])('P4-30 Important and Offers on, OS %s: saves what the answer allows, then advances', async (answer, pushes) => {
        mockPermission.mockResolvedValueOnce(answer)
        const view = render()
        fireEvent.click(important())
        fireEvent.click(offers())
        fireEvent.click(continueButton(view.container))
        expect(mockPermission).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).toHaveBeenCalledWith({ ...pushes, emailUpdates: true, pushPermission: answer }, 'new-user')
        expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.NOTIFICATION_CHOICES_SAVED, {
            variant: 'switches',
            outcome: answer,
            important: pushes.push,
            offers: pushes.marketingPush,
            email: true,
        })
        expect(view.flow().notificationChoices).toEqual(expect.objectContaining({ ...pushes, emailUpdates: true }))
        expect(mockSave.mock.invocationCallOrder[0]).toBeLessThan(mockNext.mock.invocationCallOrder[0])
    })

    it('P4-31 a failed save blocks with the callout; the retry does not ask the OS again', async () => {
        mockSave.mockRejectedValueOnce(new Error('network'))
        const { container } = render()
        fireEvent.click(important())
        fireEvent.click(continueButton(container))
        expect(await screen.findByText(textMatch(copy('setup.notifications.saveFailed')))).toBeInTheDocument()
        expect(setupState(container)).toBe('switches-save-failed')
        expect(controls()).toContain('notification_preferences:error:save_failed')
        expect(mockNext).not.toHaveBeenCalled()
        await waitFor(() => expect(continueButton(container)).toBeEnabled())
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockPermission).toHaveBeenCalledTimes(1)
        expect(mockSave).toHaveBeenCalledTimes(2)
        expect(mockSave.mock.calls[1][0]).toEqual(mockSave.mock.calls[0][0])
    })

    it('P4-31 "Not now" saves all off without asking and blocks on its failure too', async () => {
        mockSave.mockRejectedValueOnce(new Error('network'))
        const view = render()
        fireEvent.click(important())
        fireEvent.click(notNow(view.container))
        expect(await screen.findByText(textMatch(copy('setup.notifications.saveFailed')))).toBeInTheDocument()
        expect(mockSave).toHaveBeenCalledWith({ push: false, marketingPush: false, emailUpdates: false }, 'new-user')
        expect(mockPermission).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.NOTIFICATION_CHOICES_SAVED,
            expect.objectContaining({ outcome: 'skipped', important: false, offers: false, email: false })
        )
    })

    it('P4-30 a thrown OS request is recorded as dismissed', async () => {
        mockPermission.mockRejectedValueOnce(new Error('sdk'))
        const { container } = render()
        fireEvent.click(important())
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(answered()).toEqual([{ variant: 'switches', answer: 'dismissed' }])
        expect(mockSave).toHaveBeenCalledWith(
            { push: false, marketingPush: false, emailUpdates: true, pushPermission: 'dismissed' },
            'new-user'
        )
    })
})

describe('10 Notifications: defaults_on arm', () => {
    beforeEach(() => {
        mockFlag = 'defaults_on'
    })

    it('P4-29 Important and Email updates start on, Offers off, Continue on', () => {
        const { container } = render()
        expect(switchStates()).toEqual(['true', 'false', 'true'])
        expect(continueButton(container)).toBeEnabled()
        expect(setupState(container)).toBe('switches')
    })

    it('P4-29 after Back/Next the saved choices show, not the defaults', () => {
        const saved: NotificationChoices = { push: false, marketingPush: true, emailUpdates: false, cascaded: true }
        render({ notificationChoices: saved })
        expect(switchStates()).toEqual(['false', 'true', 'false'])
    })

    it('P4-30 Continue asks inside the tap and saves the defaults with the grant', async () => {
        const { container } = render()
        fireEvent.click(continueButton(container))
        expect(mockPermission).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave).toHaveBeenCalledWith(
            { push: true, marketingPush: false, emailUpdates: true, pushPermission: 'granted' },
            'new-user'
        )
        expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.NOTIFICATION_CHOICES_SAVED, {
            variant: 'defaults_on',
            outcome: 'granted',
            important: true,
            offers: false,
            email: true,
        })
    })
})

describe('P4-32 session fence', () => {
    it('control: an account change during the OS request drops the result', async () => {
        let answer!: (permission: string) => void
        mockPermission.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
        const { container } = render()
        fireEvent.click(turnOn(container))
        await waitFor(() => expect(setupState(container)).toBe('prompt'))
        otherAccount()
        await act(async () => answer('granted'))
        expect(mockSave).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
        expect(answered()).toEqual([])
        expect(setupState(container)).toBe('prompt')
    })

    it('switches: an account change during the request stops save and navigation', async () => {
        mockFlag = 'switches'
        let answer!: (permission: string) => void
        mockPermission.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
        const { container } = render()
        fireEvent.click(important())
        fireEvent.click(continueButton(container))
        otherAccount()
        await act(async () => answer('granted'))
        expect(mockSave).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('switches: a save that resolves after an account change does not advance', async () => {
        mockFlag = 'switches'
        let finish!: () => void
        mockSave.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
        const view = render()
        fireEvent.click(emailUpdates())
        fireEvent.click(continueButton(view.container))
        await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
        otherAccount()
        await act(async () => finish())
        expect(mockNext).not.toHaveBeenCalled()
        expect(capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.NOTIFICATION_CHOICES_SAVED, expect.anything())
    })

    it('switches: rechecks the account after the permission reconciliation wait', async () => {
        mockFlag = 'switches'
        let finish!: () => void
        mockAfterPermission.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
        const { container } = render()
        fireEvent.click(important())
        fireEvent.click(continueButton(container))
        await waitFor(() => expect(mockAfterPermission).toHaveBeenCalledTimes(1))
        otherAccount()
        await act(async () => finish())
        expect(mockSave).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
    })
})
