import { createElement } from 'react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'

// pins the pre-prompt rules: which money moment may ask (TASK-23251), and the
// Home fallback's dismissal logic (TASK-21145 / PR #2591) — legacy
// `notifModalClosed` bool, `notifModalClosedAt` timestamp, and the
// flag-conditional 14-day snooze.
//
// the hook keeps its state in a module-level store (init runs once per page),
// so tests share one module instance; resetPushPromptForTests() starts a fresh
// session before each test. tests that assert the prompt stays CLOSED first
// prove it would show under the same mocks (baseline true), then flip the
// mocks and offer again — a false can then only be a fresh decision, never
// leftover store state or a silent early-return on adapter failure.

// init registers the permission listener once per module; kept here because
// clearAllMocks wipes the call log between tests
let mockPermissionListener: ((permissionState: string) => void) | undefined
const mockAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue('default'),
    getPermission: jest.fn().mockResolvedValue('default'),
    isOptedIn: jest.fn().mockResolvedValue(false),
    onPermissionChange: jest.fn((listener: (permissionState: string) => void) => {
        mockPermissionListener = listener
        return () => {}
    }),
    onSubscriptionChange: jest.fn(() => () => {}),
    onNotificationClick: jest.fn(() => () => {}),
    onNotificationReceived: jest.fn(() => () => {}),
}
jest.mock('@/services/onesignal', () => ({
    getOneSignalAdapter: () => Promise.resolve(mockAdapter),
}))

// in-memory prefs store mirroring updateUserPreferences' merge behavior, so
// the once-only legacy conversion is observable across re-evaluations
let mockPrefs: Record<string, unknown> | undefined
const mockUpdateUserPreferences = jest.fn((_userId: string | undefined, partial: Record<string, unknown>) => {
    mockPrefs = { ...mockPrefs, ...partial }
})
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: () => mockPrefs,
    updateUserPreferences: (userId: string | undefined, partial: Record<string, unknown>) =>
        mockUpdateUserPreferences(userId, partial),
}))

const mockIsPwaSunsetOn = jest.fn(() => false)
jest.mock('@/utils/migration.utils', () => ({ isPwaSunsetOn: () => mockIsPwaSunsetOn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
let mockUserId = 'user-1'
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: mockUserId } } }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
// renders the copy keys, so a test can read which promise the prompt makes
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, title, description }: { visible: boolean; title: string; description: string }) =>
        visible ? `${title} | ${description}` : null,
}))
const mockSentryCaptureException = jest.fn()
const mockSentryAddBreadcrumb = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockSentryCaptureException(...args),
    captureMessage: jest.fn(),
    addBreadcrumb: (...args: unknown[]) => mockSentryAddBreadcrumb(...args),
}))

import posthog from 'posthog-js'
import { NOTIF_PROMPT_SNOOZE_DAYS } from '@/constants/migration.consts'
import { PUSH_PROMPT_TRIGGERS, type PushPromptTrigger } from '@/constants/push-prompt.consts'
import SetupNotificationsModal from '@/components/Notifications/SetupNotificationsModal'
import { offerPushPrompt, resetPushPromptForTests, useNotifications } from '../useNotifications'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString()
const expiredSnooze = () => daysAgo(NOTIF_PROMPT_SNOOZE_DAYS + 6)
const freshSnooze = () => daysAgo(1)

const { HOME_FALLBACK, DEPOSIT_INTENT, CARD_READY } = PUSH_PROMPT_TRIGGERS
const THIRD_SESSION = { sessionCount: 3 }

async function offer(trigger: PushPromptTrigger) {
    await act(async () => {
        await offerPushPrompt(trigger)
    })
}

// a new app load: the one-prompt-per-session budget is spent per session
function newSession() {
    act(() => resetPushPromptForTests())
}

async function renderInitialized() {
    const rendered = renderHook(() => useNotifications())
    await waitFor(() => expect(rendered.result.current.oneSignalInitialized).toBe(true))
    return rendered
}

// a returning user who never dismissed anything sees the Home fallback — the
// baseline every stays-closed assertion is measured against
async function renderWithShowingBaseline() {
    const rendered = await renderInitialized()
    mockPrefs = { ...THIRD_SESSION }
    await offer(HOME_FALLBACK)
    expect(rendered.result.current.showPermissionModal).toBe(true)
    newSession()
    return rendered
}

const capturedWith = (event: string) =>
    (posthog.capture as jest.Mock).mock.calls.filter(([name]) => name === event).map(([, props]) => props)

describe('useNotifications dismissal / snooze logic', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        resetPushPromptForTests()
        mockPrefs = undefined
        mockUserId = 'user-1'
        mockIsPwaSunsetOn.mockReturnValue(false)
        mockAdapter.getPermission.mockResolvedValue('default')
        mockAdapter.isOptedIn.mockResolvedValue(false)
        mockAdapter.requestPermission.mockResolvedValue('default')
    })

    it('shows the Home fallback from the third session for a user who never dismissed it', async () => {
        await renderWithShowingBaseline()
    })

    it('converts legacy notifModalClosed to a timestamp exactly once', async () => {
        const rendered = await renderWithShowingBaseline()

        mockPrefs = { ...THIRD_SESSION, notifModalClosed: true }
        await offer(HOME_FALLBACK)

        expect(mockPrefs?.notifModalClosedAt).toEqual(expect.any(String))
        // legacy dismissal converts to a snooze that starts now → stays closed
        expect(rendered.result.current.showPermissionModal).toBe(false)

        // re-evaluate: the timestamp is already there, no second write
        const conversionWrites = () =>
            mockUpdateUserPreferences.mock.calls.filter(([, partial]) => 'notifModalClosedAt' in partial)
        expect(conversionWrites()).toHaveLength(1)
        await offer(HOME_FALLBACK)
        expect(conversionWrites()).toHaveLength(1)
    })

    it('flag off: an expired snooze stays closed forever', async () => {
        const rendered = await renderWithShowingBaseline()

        mockPrefs = { ...THIRD_SESSION, notifModalClosedAt: expiredSnooze() }
        await offer(HOME_FALLBACK)

        expect(rendered.result.current.showPermissionModal).toBe(false)
    })

    it('flag on: an expired snooze re-asks', async () => {
        mockIsPwaSunsetOn.mockReturnValue(true)
        const rendered = await renderInitialized()
        mockPrefs = { ...THIRD_SESSION, notifModalClosedAt: expiredSnooze() }
        await offer(HOME_FALLBACK)

        expect(rendered.result.current.showPermissionModal).toBe(true)
    })

    it('flag on: a fresh snooze stays closed', async () => {
        mockIsPwaSunsetOn.mockReturnValue(true)
        const rendered = await renderWithShowingBaseline()

        mockPrefs = { ...THIRD_SESSION, notifModalClosedAt: freshSnooze() }
        await offer(HOME_FALLBACK)

        expect(rendered.result.current.showPermissionModal).toBe(false)
    })

    it('granted permission hides an open prompt and no trigger asks again', async () => {
        const rendered = await renderWithShowingBaseline()
        await offer(DEPOSIT_INTENT)
        expect(rendered.result.current.showPermissionModal).toBe(true)

        mockAdapter.getPermission.mockResolvedValue('granted')
        await act(async () => {
            await rendered.result.current.refreshPermissionState()
        })
        expect(rendered.result.current.showPermissionModal).toBe(false)

        newSession()
        await offer(CARD_READY)
        expect(rendered.result.current.showPermissionModal).toBe(false)
    })

    it('denied permission stops every trigger', async () => {
        const rendered = await renderWithShowingBaseline()

        mockAdapter.getPermission.mockResolvedValue('denied')
        await offer(DEPOSIT_INTENT)

        expect(rendered.result.current.showPermissionModal).toBe(false)
    })

    it.each(['Permission dismissed', 'Permission blocked'])(
        'breadcrumbs an expected permission outcome without reporting it: %s',
        async (message) => {
            const rendered = await renderWithShowingBaseline()
            mockAdapter.requestPermission.mockRejectedValueOnce(new Error(message))

            await act(async () => {
                await expect(rendered.result.current.requestPermission()).resolves.toBe('default')
            })

            expect(mockSentryCaptureException).not.toHaveBeenCalled()
            expect(mockSentryAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'onesignal.permission', level: 'info' })
            )
        }
    )

    it('still reports a technical permission SDK failure', async () => {
        const rendered = await renderWithShowingBaseline()
        const failure = new Error('OneSignal SDK transport failed')
        mockAdapter.requestPermission.mockRejectedValueOnce(failure)

        await act(async () => {
            await expect(rendered.result.current.requestPermission()).resolves.toBe('default')
        })

        expect(mockSentryCaptureException).toHaveBeenCalledWith(failure, {
            tags: { source: 'onesignal_request_permission' },
        })
    })
})

describe('useNotifications money-moment triggers (TASK-23251)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        resetPushPromptForTests()
        mockPrefs = undefined
        mockUserId = 'user-1'
        mockIsPwaSunsetOn.mockReturnValue(true)
        mockAdapter.getPermission.mockResolvedValue('default')
        mockAdapter.isOptedIn.mockResolvedValue(false)
        mockAdapter.requestPermission.mockResolvedValue('default')
    })

    it('does not ask on the first Home visits', async () => {
        const rendered = await renderWithShowingBaseline()

        for (const sessionCount of [1, 2]) {
            mockPrefs = { sessionCount }
            await offer(HOME_FALLBACK)
            expect(rendered.result.current.showPermissionModal).toBe(false)
        }
    })

    it('counts one session per app load', async () => {
        mockPrefs = { sessionCount: 2 }
        mockUserId = 'user-2'
        const rendered = await renderInitialized()
        rendered.rerender()

        const sessionWrites = mockUpdateUserPreferences.mock.calls.filter(([, partial]) => 'sessionCount' in partial)
        expect(sessionWrites).toEqual([['user-2', { sessionCount: 3 }]])
    })

    it('asks at deposit intent in the first session, with the deposit promise', async () => {
        const rendered = await renderInitialized()
        mockPrefs = { sessionCount: 1 }
        await offer(DEPOSIT_INTENT)

        expect(rendered.result.current.showPermissionModal).toBe(true)
        expect(rendered.result.current.promptTrigger).toBe(DEPOSIT_INTENT)
        render(createElement(SetupNotificationsModal))
        expect(screen.getByText('depositIntentTitle | depositIntentDescription')).toBeTruthy()
    })

    it('keeps a moment that came before the user id and asks once it is known', async () => {
        await renderInitialized()
        mockUserId = ''
        const rendered = renderHook(() => useNotifications())
        await offer(CARD_READY)
        expect(rendered.result.current.showPermissionModal).toBe(false)

        mockUserId = 'user-3'
        rendered.rerender()
        await waitFor(() => expect(rendered.result.current.promptTrigger).toBe(CARD_READY))
        expect(rendered.result.current.showPermissionModal).toBe(true)
    })

    it('a snoozed early moment does not block a later eligible one', async () => {
        await renderInitialized()
        mockPrefs = { notifPromptClosedAt: { [CARD_READY]: freshSnooze() } }
        mockUserId = ''
        const rendered = renderHook(() => useNotifications())
        await offer(CARD_READY)
        await offer(DEPOSIT_INTENT)

        mockUserId = 'user-4'
        rendered.rerender()
        await waitFor(() => expect(rendered.result.current.promptTrigger).toBe(DEPOSIT_INTENT))
        expect(rendered.result.current.showPermissionModal).toBe(true)
    })

    it('shows at most one pre-prompt per session', async () => {
        const rendered = await renderInitialized()
        await offer(DEPOSIT_INTENT)
        act(() => rendered.result.current.closePermissionModal())

        await offer(CARD_READY)
        expect(rendered.result.current.showPermissionModal).toBe(false)
    })

    it('a dismissed trigger stays quiet for 14 days, another trigger may still ask', async () => {
        const rendered = await renderInitialized()
        await offer(DEPOSIT_INTENT)
        act(() => rendered.result.current.closePermissionModal())
        expect(mockPrefs?.notifPromptClosedAt).toEqual({ [DEPOSIT_INTENT]: expect.any(String) })

        newSession()
        await offer(DEPOSIT_INTENT)
        expect(rendered.result.current.showPermissionModal).toBe(false)

        await offer(CARD_READY)
        expect(rendered.result.current.promptTrigger).toBe(CARD_READY)
        expect(rendered.result.current.showPermissionModal).toBe(true)

        // the deposit snooze survives the card dismissal, and ends after 14 days
        act(() => rendered.result.current.closePermissionModal())
        newSession()
        await offer(DEPOSIT_INTENT)
        expect(rendered.result.current.showPermissionModal).toBe(false)

        mockPrefs = { notifPromptClosedAt: { [DEPOSIT_INTENT]: expiredSnooze() } }
        newSession()
        await offer(DEPOSIT_INTENT)
        expect(rendered.result.current.showPermissionModal).toBe(true)
    })

    it('a money-moment dismissal also snoozes the Home fallback', async () => {
        const rendered = await renderInitialized()
        mockPrefs = { ...THIRD_SESSION }
        await offer(DEPOSIT_INTENT)
        act(() => rendered.result.current.closePermissionModal())

        newSession()
        await offer(HOME_FALLBACK)
        expect(rendered.result.current.showPermissionModal).toBe(false)
    })

    it('stamps the trigger on the prompt and permission events', async () => {
        const rendered = await renderInitialized()
        await offer(CARD_READY)
        await act(async () => {
            await rendered.result.current.requestPermission()
            await rendered.result.current.afterPermissionAttempt()
        })

        expect(capturedWith('modal_shown')).toEqual([{ modal_type: 'notifications', trigger: CARD_READY }])
        expect(capturedWith('notification_permission_requested')).toEqual([{ trigger: CARD_READY }])
        // an unanswered OS dialog snoozes the moment like "Not now"
        expect(mockPrefs?.notifPromptClosedAt).toEqual({ [CARD_READY]: expect.any(String) })

        newSession()
        await offer(DEPOSIT_INTENT)
        act(() => rendered.result.current.closePermissionModal())
        expect(capturedWith('modal_dismissed')).toEqual([{ modal_type: 'notifications', trigger: DEPOSIT_INTENT }])
    })

    it('stamps the trigger on the permission-granted event', async () => {
        const rendered = await renderInitialized()
        await offer(DEPOSIT_INTENT)
        await act(async () => {
            await rendered.result.current.requestPermission()
        })
        await act(async () => mockPermissionListener?.('granted'))

        expect(capturedWith('notification_permission_granted')).toEqual([{ trigger: DEPOSIT_INTENT }])
    })
})
