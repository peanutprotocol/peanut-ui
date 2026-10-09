import { act, renderHook } from '@testing-library/react'
import { captureException } from '@sentry/nextjs'

let mockEnvironment = 'preview'
const mockInit = jest.fn()
const mockAdapter = {
    init: mockInit,
    requestPermission: jest.fn(async () => 'granted'),
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
jest.mock('@/utils/sentry-env', () => ({ inferSentryEnvironment: () => mockEnvironment }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: jest.fn(), updateUserPreferences: jest.fn() }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

import { useNotifications } from '../useNotifications'

async function initFailingWith(message: string) {
    mockInit.mockRejectedValueOnce(new Error(message))
    const view = renderHook(() => useNotifications())
    await act(async () => {
        await view.result.current.requestPermission().catch(() => {})
    })
}

describe('OneSignal origin refusal', () => {
    beforeEach(() => {
        jest.mocked(captureException).mockClear()
        jest.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('is not reported from a preview deploy, which OneSignal refuses by design', async () => {
        mockEnvironment = 'preview'
        await initFailingWith('Can only be used on: https://staging.peanut.me')
        expect(captureException).not.toHaveBeenCalled()
    })

    it('is reported on production, where it means push is misconfigured', async () => {
        mockEnvironment = 'production'
        await initFailingWith('Can only be used on: https://peanut.me')
        expect(captureException).toHaveBeenCalledTimes(1)
    })

    it('still reports any other init failure from a preview deploy', async () => {
        mockEnvironment = 'preview'
        await initFailingWith('OneSignal script blocked')
        expect(captureException).toHaveBeenCalledTimes(1)
    })
})
