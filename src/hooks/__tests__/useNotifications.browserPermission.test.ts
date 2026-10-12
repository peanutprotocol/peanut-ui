import { act, renderHook, waitFor } from '@testing-library/react'

let mockFinishInit: () => void
const mockInit = jest.fn(
    () =>
        new Promise<void>((resolve) => {
            mockFinishInit = resolve
        })
)
const mockRequest = jest.fn(async () => 'granted')
const mockAdapter = {
    init: mockInit,
    requestPermission: mockRequest,
    getPermission: async () => 'default',
    isOptedIn: async () => false,
    onPermissionChange: jest.fn(),
    onSubscriptionChange: jest.fn(),
    onNotificationClick: jest.fn(),
    onNotificationReceived: jest.fn(),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: async () => mockAdapter }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: jest.fn(), updateUserPreferences: jest.fn() }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

import { useNotifications } from '../useNotifications'

it('starts the browser prompt in the click gesture without waiting for SDK initialization, then registers delivery', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'Notification')
    const request = jest.fn(async () => 'granted')
    Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: { permission: 'default', requestPermission: request },
    })
    try {
        const view = renderHook(() => useNotifications())
        await waitFor(() => expect(mockInit).toHaveBeenCalledTimes(1))
        await act(async () => {
            const permission = view.result.current.requestPermission()
            // Assertion before awaiting anything: transient user activation is retained.
            expect(request).toHaveBeenCalledTimes(1)
            await expect(permission).resolves.toBe('granted')
        })
        expect(mockRequest).not.toHaveBeenCalled()
        expect(view.result.current.permissionState).toBe('granted')
        await act(async () => {
            mockFinishInit()
        })
        await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
        view.unmount()
    } finally {
        if (original) Object.defineProperty(window, 'Notification', original)
        else Reflect.deleteProperty(window, 'Notification')
    }
})
