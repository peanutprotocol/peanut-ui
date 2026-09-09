import { act, renderHook, waitFor } from '@testing-library/react'

// Init publishes `oneSignalInitialized` before its first login() resolves, so a
// false → true opt-in that lands in that window used to start a second login()
// for the same id (lastLinkedExternalId is committed only after the first
// resolves) — the same double-record race TASK-22209 closed on the change
// listener. Pin: a sync for an id whose login is in flight joins it.

let userId = 'user-1'
const pendingLogins = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()
const mockAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    login: jest.fn(
        (id: string) =>
            new Promise<void>((resolve, reject) => {
                pendingLogins.set(id, { resolve, reject })
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
jest.mock('@/redux/hooks', () => ({ useUserStore: () => ({ user: { user: { userId } } }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

import type { PushSubscriptionChange } from '@/services/onesignal'
import { useNotifications } from '../useNotifications'

describe('useNotifications initial login', () => {
    it('joins the in-flight login, and a late-settling older login keeps the newer id guarded', async () => {
        const rendered = renderHook(() => useNotifications())
        await waitFor(() => expect(rendered.result.current.oneSignalInitialized).toBe(true))
        await waitFor(() => expect(mockAdapter.login).toHaveBeenCalledWith('user-1'))
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)
        const onSubscriptionChange = mockAdapter.onSubscriptionChange.mock.calls[0][0]

        // the opt-in lands while init's login is still pending: join it, never
        // start a second login for the same id (the duplicate-record race)
        await act(async () => {
            onSubscriptionChange({ optedIn: true, previousOptedIn: false })
        })
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)

        // switch accounts while that first login is STILL pending
        userId = 'user-2'
        rendered.rerender()
        await waitFor(() => expect(mockAdapter.login).toHaveBeenCalledWith('user-2'))
        expect(mockAdapter.login).toHaveBeenCalledTimes(2)

        // the newer login lands first, then the older one settles: neither the
        // guard nor the bookkeeping may end up naming the account we left
        await act(async () => {
            pendingLogins.get('user-2')!.resolve()
        })
        await act(async () => {
            pendingLogins.get('user-1')!.resolve()
        })
        await act(async () => {
            onSubscriptionChange({ optedIn: false, previousOptedIn: true })
            onSubscriptionChange({ optedIn: true, previousOptedIn: false })
        })
        expect(mockAdapter.login).toHaveBeenCalledTimes(2)
    })

    it('retries once when the login it joined fails', async () => {
        // a joined caller sees no error of its own: without a re-check the
        // device stays unlinked and every push for it reaches nobody
        userId = 'user-3'
        renderHook(() => useNotifications())
        await waitFor(() => expect(mockAdapter.login).toHaveBeenCalledWith('user-3'))
        const callsAfterFirst = mockAdapter.login.mock.calls.length
        const onSubscriptionChange = mockAdapter.onSubscriptionChange.mock.calls[0][0]

        // the opt-in joins that pending login, which then fails
        await act(async () => {
            onSubscriptionChange({ optedIn: true, previousOptedIn: false })
        })
        expect(mockAdapter.login).toHaveBeenCalledTimes(callsAfterFirst)

        await act(async () => {
            pendingLogins.get('user-3')!.reject(new Error('network down'))
        })
        await waitFor(() => expect(mockAdapter.login).toHaveBeenCalledTimes(callsAfterFirst + 1))
        expect(mockAdapter.login).toHaveBeenLastCalledWith('user-3')
    })
})
