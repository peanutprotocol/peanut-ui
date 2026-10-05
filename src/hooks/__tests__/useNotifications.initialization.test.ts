import { act, renderHook } from '@testing-library/react'

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

it('joins pending initialization and opens the OS prompt instead of silently skipping it', async () => {
    const view = renderHook(() => useNotifications())
    let first: Promise<unknown>
    await act(async () => {
        first = view.result.current.requestPermission()
        await Promise.resolve()
    })
    expect(mockInit).toHaveBeenCalledTimes(1)
    expect(mockRequest).not.toHaveBeenCalled()
    await act(async () => {
        mockFinishInit()
        await expect(first!).resolves.toBe('granted')
    })
    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(view.result.current.permissionState).toBe('granted')
})
