import { act, renderHook, waitFor } from '@testing-library/react'

// TASK-22209: OneSignal fires the push-subscription `change` event several
// times for one opt-in (opt-in flips, token registers, server assigns the id)
// and again on a token refresh after reload. The hook used to call login()
// and capture `notification_subscribed` on every `optedIn: true`, and the
// login re-registered the half-created subscription as a second record —
// which OneSignal greets with a second welcome notification. Pin: only the
// false → true opt-in transition acts; a real re-subscribe acts again.

const mockAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
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
const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { PushSubscriptionChange } from '@/services/onesignal'
import { useNotifications } from '../useNotifications'

const subscribedCaptures = () =>
    mockCapture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.NOTIFICATION_SUBSCRIBED)

// the SDK's `change` events for one opt-in: the opt-in flips first (no token
// yet), then the token registers, then the server assigns the id — each with
// optedIn already true; later a reload refreshes the token the same way
const optedInFlipped: PushSubscriptionChange = { optedIn: true, previousOptedIn: false }
const tokenRegistered: PushSubscriptionChange = { optedIn: true, previousOptedIn: true }
const idAssigned: PushSubscriptionChange = { optedIn: true, previousOptedIn: true }
const tokenRefreshed: PushSubscriptionChange = { optedIn: true, previousOptedIn: true }
const optedOut: PushSubscriptionChange = { optedIn: false, previousOptedIn: true }
const optedBackIn: PushSubscriptionChange = { optedIn: true, previousOptedIn: false }

describe('useNotifications subscription change', () => {
    it('acts once on one opt-in however many change events OneSignal splits it into', async () => {
        const rendered = renderHook(() => useNotifications())
        await waitFor(() => expect(rendered.result.current.oneSignalInitialized).toBe(true))
        // init already linked the device to the user
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)
        const onSubscriptionChange = mockAdapter.onSubscriptionChange.mock.calls[0][0]

        await act(async () => {
            onSubscriptionChange(optedInFlipped)
            onSubscriptionChange(tokenRegistered)
            onSubscriptionChange(idAssigned)
        })

        expect(rendered.result.current.isPushOptedIn).toBe(true)
        expect(subscribedCaptures()).toHaveLength(1)
        // no second login: the init link stands, nothing to retry
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)

        // an already opted-in device refreshing its token on reload is not an opt-in
        await act(async () => {
            onSubscriptionChange(tokenRefreshed)
        })
        expect(subscribedCaptures()).toHaveLength(1)

        // a real re-subscribe is a false → true transition and counts again
        await act(async () => {
            onSubscriptionChange(optedOut)
        })
        expect(rendered.result.current.isPushOptedIn).toBe(false)
        await act(async () => {
            onSubscriptionChange(optedBackIn)
        })
        expect(subscribedCaptures()).toHaveLength(2)
        expect(mockAdapter.login).toHaveBeenCalledTimes(1)
    })
})
