jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, renderHook } from '@testing-library/react'

const mockInit = jest.fn(() => new Promise<void>(() => {}))
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
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
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

it('a logged-out visitor never initializes the push SDK', async () => {
    renderHook(() => useNotifications())
    await act(async () => {
        await Promise.resolve()
    })
    expect(mockInit).not.toHaveBeenCalled()
})
