import { act, renderHook, waitFor } from '@testing-library/react'

// pins the dismissal logic in evaluateVisibility (TASK-21145 / PR #2591):
// the pre-prompt carries three dismissal representations — legacy
// `notifModalClosed` bool, `notifModalClosedAt` timestamp, and the
// flag-conditional 14-day snooze — and none of it was tested.
//
// the hook keeps its state in a module-level store (init runs once per page),
// so tests share one module instance and drive a fresh evaluateVisibility via
// refreshPermissionState() — every branch of the evaluation ends in a
// definitive setState, so each test's outcome is recomputed from its own mocks.

const mockAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue('default'),
    getPermission: jest.fn().mockResolvedValue('default'),
    isOptedIn: jest.fn().mockResolvedValue(false),
    onPermissionChange: jest.fn(() => () => {}),
    onSubscriptionChange: jest.fn(() => () => {}),
    onNotificationClick: jest.fn(() => () => {}),
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
jest.mock('@/redux/hooks', () => ({ useUserStore: () => ({ user: { user: { userId: 'user-1' } } }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

import { useNotifications } from '../useNotifications'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString()

async function renderAndEvaluate() {
    const rendered = renderHook(() => useNotifications())
    await waitFor(() => expect(rendered.result.current.oneSignalInitialized).toBe(true))
    // force a full evaluateVisibility pass under THIS test's mocks (the shared
    // module store may carry showPermissionModal from a previous test)
    await act(async () => {
        await rendered.result.current.refreshPermissionState()
    })
    return rendered
}

describe('useNotifications dismissal / snooze logic', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockPrefs = undefined
        mockIsPwaSunsetOn.mockReturnValue(false)
        mockAdapter.getPermission.mockResolvedValue('default')
        mockAdapter.isOptedIn.mockResolvedValue(false)
    })

    it('shows the modal for a user who never dismissed it', async () => {
        const { result } = await renderAndEvaluate()
        expect(result.current.showPermissionModal).toBe(true)
    })

    it('converts legacy notifModalClosed to a timestamp exactly once', async () => {
        mockPrefs = { notifModalClosed: true }

        const { result } = await renderAndEvaluate()
        expect(mockPrefs?.notifModalClosedAt).toEqual(expect.any(String))
        // legacy dismissal converts to a snooze that starts now → stays closed
        expect(result.current.showPermissionModal).toBe(false)

        // re-evaluate: the timestamp is already there, no second write
        const conversionWrites = () =>
            mockUpdateUserPreferences.mock.calls.filter(([, partial]) => 'notifModalClosedAt' in partial)
        expect(conversionWrites()).toHaveLength(1)
        await act(async () => {
            await result.current.refreshPermissionState()
        })
        expect(conversionWrites()).toHaveLength(1)
    })

    it('flag off: an expired snooze stays closed forever', async () => {
        mockPrefs = { notifModalClosedAt: daysAgo(20) }

        const { result } = await renderAndEvaluate()
        expect(result.current.showPermissionModal).toBe(false)
    })

    it('flag on: an expired snooze re-asks', async () => {
        mockIsPwaSunsetOn.mockReturnValue(true)
        mockPrefs = { notifModalClosedAt: daysAgo(20) }

        const { result } = await renderAndEvaluate()
        expect(result.current.showPermissionModal).toBe(true)
    })

    it('flag on: a fresh snooze stays closed', async () => {
        mockIsPwaSunsetOn.mockReturnValue(true)
        mockPrefs = { notifModalClosedAt: daysAgo(1) }

        const { result } = await renderAndEvaluate()
        expect(result.current.showPermissionModal).toBe(false)
    })

    it('granted permission hides the modal regardless of dismissal state', async () => {
        mockAdapter.getPermission.mockResolvedValue('granted')
        mockIsPwaSunsetOn.mockReturnValue(true)
        mockPrefs = { notifModalClosedAt: daysAgo(20) }

        const { result } = await renderAndEvaluate()
        expect(result.current.showPermissionModal).toBe(false)
    })
})
