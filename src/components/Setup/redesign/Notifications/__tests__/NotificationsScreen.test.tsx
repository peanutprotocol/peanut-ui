/** @jest-environment jsdom */
/**
 * 10 Notifications (`notification-permission`), contract P4 § 3: the drawn one-button form ("Turn on
 * notifications" + "Not now") with dev's outcomes; "Open settings" shows only where canOpenAppSettings() is true.
 * Ports dev's NotificationSetup.test.tsx and Notifications.analytics.test.tsx.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
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
const answered = () =>
    capture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.SIGNUP_PUSH_PERMISSION_ANSWERED).map(([, p]) => p)
const deniedNote = () => screen.queryByText(textMatch(copy('setupRedesign.notif.denied')))
const openSettingsText = () => tagCopy('setupRedesign.notif.openSettings', 'link')
const otherAccount = () => setAuthToken(`x.${btoa(JSON.stringify({ userId: 'another-user' }))}.y`)

beforeEach(() => {
    jest.clearAllMocks()
    setAuthToken(`x.${btoa(JSON.stringify({ userId: 'new-user' }))}.y`)
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
})

describe('10 Notifications: Turn on and Not now', () => {
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
        expect(answered()).toEqual([{ answer: 'granted' }])
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

    // Orchestrator ruling on R1-04: "Not now" is dev's explicit opt-out and saves `push: false` before advancing.
    it('P4-22 "Not now" asks nothing, saves exactly the push opt-out, then advances once', async () => {
        const view = render()
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockPermission).not.toHaveBeenCalled()
        expect(mockSave.mock.calls).toEqual([[{ push: false }, 'new-user']])
        expect(mockSave.mock.invocationCallOrder[0]).toBeLessThan(mockNext.mock.invocationCallOrder[0])
        expect(controls()).toEqual(['not_now:tap'])
        expect(view.flow().notificationChoices.push).toBe(false)
    })

    it('P4-23 a thrown request: back to default, no callout, recorded as dismissed, push off', async () => {
        mockPermission.mockRejectedValueOnce(new Error('sdk'))
        const view = render()
        fireEvent.click(turnOn(view.container))
        await waitFor(() => expect(answered()).toEqual([{ answer: 'dismissed' }]))
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
        await waitFor(() => expect(answered()).toEqual([{ answer: 'dismissed' }]))
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
        // the primary's label crossfades in 100 ms
        await waitFor(() =>
            expect(primary(view.container)).toHaveAccessibleName(copyRx('setupRedesign.common.continue'))
        )
        expect(view.flow().notificationChoices.push).toBe(false)
        expect(controls()).toContain('push_permission:error:denied')
        expect(answered()).toEqual([{ answer: 'denied' }])
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
        // the primary's label crossfades in 100 ms
        fireEvent.click(await waitFor(() => continueButton(container)))
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

/**
 * Dev's control-arm cases (`Views/__tests__/NotificationSetup.test.tsx` "control: the single push switch" and the
 * control cases of `Notifications.analytics.test.tsx`), ported to the one-button form: dev's switch on is "Turn on",
 * dev's on-then-off opt-out is "Not now".
 */
describe('10 Notifications: control opt-out (dev ports)', () => {
    const saveFailedLine = () => screen.queryByText(textMatch(copy('setup.notifications.saveFailed')))
    const errors = () => controls().filter((c) => c.split(':')[1] === 'error')

    it('starts with push off and asks or saves nothing until a tap', () => {
        const view = render()
        expect(view.flow().notificationChoices.push).toBe(false)
        expect(screen.queryAllByRole('switch')).toHaveLength(0)
        expect(mockPermission).not.toHaveBeenCalled()
        expect(mockSave).not.toHaveBeenCalled()
        expect(controls()).toEqual([])
    })

    it('asks the OS inside the "Turn on" tap, records the answer, and saves the grant', async () => {
        const view = render()
        fireEvent.click(turnOn(view.container))
        expect(mockPermission).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(answered()).toEqual([{ answer: 'granted' }])
        expect(mockSave.mock.calls).toEqual([[{ push: true, pushPermission: 'granted' }, 'new-user']])
    })

    it.each([
        ['denied', 'denied'],
        ['default', 'dismissed'],
    ])('an OS answer of %s turns push back off and saves nothing', async (answer, recorded) => {
        mockPermission.mockResolvedValueOnce(answer)
        const view = render()
        fireEvent.click(turnOn(view.container))
        await waitFor(() => expect(answered()).toEqual([{ answer: recorded }]))
        await waitFor(() => expect(setupState(view.container)).toBe(answer === 'denied' ? 'denied' : 'default'))
        expect(view.flow().notificationChoices.push).toBe(false)
        expect(mockSave).not.toHaveBeenCalled()
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('"Not now" after an earlier grant saves the opt-out and turns push off', async () => {
        const view = render({
            notificationChoices: { push: true, marketingPush: false, emailUpdates: false, cascaded: false },
        })
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockSave.mock.calls).toEqual([[{ push: false }, 'new-user']])
        expect(view.flow().notificationChoices.push).toBe(false)
        expect(mockPermission).not.toHaveBeenCalled()
    })

    it('blocks on a failed opt-out save, retries one save at a time, and advances on the acknowledgement', async () => {
        mockSave.mockRejectedValueOnce(new Error('network'))
        let acknowledge!: () => void
        mockSave.mockReturnValueOnce(new Promise<void>((resolve) => (acknowledge = resolve)))
        const view = render()
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(saveFailedLine()).toBeInTheDocument())
        expect(mockNext).not.toHaveBeenCalled()
        expect(view.flow().notificationChoices.push).toBe(false)
        expect(mockSave).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(notNow(view.container)).toBeEnabled())
        fireEvent.click(notNow(view.container))
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2))
        expect(saveFailedLine()).not.toBeInTheDocument()
        expect(mockNext).not.toHaveBeenCalled()
        expect(mockSave.mock.calls).toEqual([
            [{ push: false }, 'new-user'],
            [{ push: false }, 'new-user'],
        ])
        await act(async () => acknowledge())
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(mockPermission).not.toHaveBeenCalled()
    })

    it('"Turn on" after a failed opt-out clears the failure', async () => {
        mockSave.mockRejectedValueOnce(new Error('network'))
        const view = render()
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(saveFailedLine()).toBeInTheDocument())
        await waitFor(() => expect(turnOn(view.container)).toBeEnabled())
        fireEvent.click(turnOn(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(saveFailedLine()).not.toBeInTheDocument()
        expect(mockSave.mock.calls[1]).toEqual([{ push: true, pushPermission: 'granted' }, 'new-user'])
    })

    it('reports "Turn on" and "Not now" once each, with the common context', async () => {
        mockPermission.mockResolvedValueOnce('default')
        const view = render()
        fireEvent.click(turnOn(view.container))
        await waitFor(() => expect(setupState(view.container)).toBe('default'))
        await waitFor(() => expect(notNow(view.container)).toBeEnabled())
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(controls()).toEqual(['push:toggle:on', 'push_permission:error:dismissed', 'not_now:tap'])
        const calls = capture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)
        for (const [, props] of calls)
            expect(props).toEqual(expect.objectContaining({ flow: 'signup', screen_id: 'notification-permission' }))
    })

    it('reports "Not now" once without a value', async () => {
        const view = render()
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        const taps = capture.mock.calls
            .filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)
            .map(([, props]) => props)
            .filter((props) => props.action === 'tap')
        expect(taps).toHaveLength(1)
        expect(taps[0]).toEqual(expect.objectContaining({ control: 'not_now', action: 'tap' }))
        expect(taps[0]).not.toHaveProperty('value')
    })

    it('reports an opt-out save failure once, never with its message, and clears it for a good retry', async () => {
        mockSave.mockRejectedValueOnce(new Error('private opt-out failure'))
        const view = render()
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(saveFailedLine()).toBeInTheDocument())
        expect(errors()).toEqual(['notification_preferences:error:save_failed'])
        view.rerenderSame()
        expect(errors()).toHaveLength(1)
        await waitFor(() => expect(notNow(view.container)).toBeEnabled())
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockNext).toHaveBeenCalledTimes(1))
        expect(errors()).toHaveLength(1)
        expect(mockSave).toHaveBeenCalledTimes(2)
        expect(JSON.stringify(capture.mock.calls)).not.toContain('private opt-out failure')
    })

    it('an account change during the opt-out save does not advance', async () => {
        let finish!: () => void
        mockSave.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
        const view = render()
        fireEvent.click(notNow(view.container))
        await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
        otherAccount()
        await act(async () => finish())
        expect(mockNext).not.toHaveBeenCalled()
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
})
