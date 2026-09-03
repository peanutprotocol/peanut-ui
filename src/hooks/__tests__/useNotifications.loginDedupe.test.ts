import { act, renderHook, waitFor } from '@testing-library/react'

// Init publishes `oneSignalInitialized` before its first login() resolves, so a
// false → true opt-in that lands in that window used to start a second login()
// for the same id (lastLinkedExternalId is committed only after the first
// resolves) — the same double-record race TASK-22209 closed on the change
// listener. Pin: a sync for an id whose login is in flight joins it.

let resolveLogin: () => void = () => {}
const mockAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    login: jest.fn(
        () =>
            new Promise<void>((resolve) => {
                resolveLogin = resolve
            })
    ),
    logout: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue('default'),
    getPermission: jest.fn().mockResolvedValue('default'),
    isOptedIn: jest.fn().mockResolvedValue(false),
    onPermissionChange: jest.fn(() => () => {}),
    onSubscriptionChange: jest.fn((_listener: (change: PushSubscriptionChange) => void) => () => {}),
    onNotificationClick: jest.fn(() => () => {}),
}
jest.mock('@/services/onesignal', () => ({
    getOneSignalAdapter: () => Promise.resolve(mockAdapter),
}))
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: () => undefined,
    updateUserPreferences: jest.fn(),
}))
jest.mock('@/utils/migration.utils', () => ({ isPwaSunsetOn: () => false }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/redux/hooks', () => ({ useUserStore: () => ({ user: { user: { userId: 'user-1' } } }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

import type { PushSubscriptionChange } from '@/services/onesignal'
import { useNotifications } from '../useNotifications'

describe('useNotifications initial login', () => {
    it('joins the in-flight init login instead of starting a second one', async () => {
        const rendered = renderHook(() => useNotifications())
        await waitFor(() => expect(rendered.result.current.oneSignalInitialized).toBe(true))
        await waitFor(() => expect(mockAdapter.login).toHaveBeenCalledTimes(1))
        const onSubscriptionChange = mockAdapter.onSubscriptionChange.mock.calls[0][0]

        // the opt-in lands while init's login() is still pending
        await act(async () => {
            onSubscriptionChange({ optedIn: true, previousOptedIn: false })
        })
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveLogin()
        })
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)
    })
})
