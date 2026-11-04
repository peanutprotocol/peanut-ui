jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import * as React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

let mockUserId: string | null = 'user-1'
let mockNative = false
const mockGetPreferences = jest.fn()
const mockSavePreferences = jest.fn()
const mockAdapter = {
    init: jest.fn(),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue('default'),
    getPermission: jest.fn(),
    isOptedIn: jest.fn().mockResolvedValue(false),
    onPermissionChange: jest.fn(() => () => {}),
    onSubscriptionChange: jest.fn(() => () => {}),
    onNotificationClick: jest.fn(() => () => {}),
    onNotificationReceived: jest.fn(() => () => {}),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: async () => mockAdapter }))
jest.mock('@/services/notifications', () => ({
    ...jest.requireActual('@/services/notifications'),
    notificationsApi: {
        getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
        savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
    },
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId } } : null }),
}))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: jest.fn(), updateUserPreferences: jest.fn() }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

const originalNotification = Object.getOwnPropertyDescriptor(window, 'Notification')
const setBrowserPermission = (permission: NotificationPermission) => {
    Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: { permission, requestPermission: jest.fn() },
    })
}
const serverPreferences = (pushPermission: string) => ({
    push: false,
    email: true,
    marketingPush: true,
    emailUpdates: false,
    pushPermission,
})

beforeEach(() => {
    jest.resetModules()
    // Fresh app singleton, same React instance as the renderer.
    jest.doMock('react', () => React)
    jest.clearAllMocks()
    mockUserId = 'user-1'
    mockNative = false
    mockAdapter.init.mockReset().mockResolvedValue(undefined)
    mockAdapter.getPermission.mockReset().mockResolvedValue('default')
    mockGetPreferences.mockReset().mockResolvedValue(serverPreferences('denied'))
    mockSavePreferences.mockReset().mockResolvedValue({})
    setBrowserPermission('granted')
})

afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    if (originalNotification) Object.defineProperty(window, 'Notification', originalNotification)
    else Reflect.deleteProperty(window, 'Notification')
})

const mount = () => {
    const { useNotifications } = require('../useNotifications') as typeof import('../useNotifications')
    return renderHook(() => useNotifications())
}

it('reports a browser grant exactly once without changing consent', async () => {
    setBrowserPermission('granted')
    mockGetPreferences.mockResolvedValue(serverPreferences('denied'))
    const view = mount()
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1))
    expect(mockSavePreferences.mock.calls).toEqual([[{ pushPermission: 'granted' }]])
    for (let i = 0; i < 3; i++) view.rerender()
    await act(async () => {})
    const secondConsumer = mount()
    await act(async () => {})
    expect(mockGetPreferences).toHaveBeenCalledTimes(1)
    expect(mockSavePreferences).toHaveBeenCalledTimes(1)
    secondConsumer.unmount()
})

it.each(['denied', 'default'] as const)(
    "a browser that is %s never overwrites another device's grant",
    async (permission) => {
        setBrowserPermission(permission)
        mockGetPreferences.mockResolvedValue(serverPreferences('granted'))
        const view = mount()
        await waitFor(() => expect(mockGetPreferences).toHaveBeenCalledTimes(1))
        await act(async () => {})
        view.rerender()
        await act(async () => {})
        expect(mockSavePreferences).not.toHaveBeenCalled()
    }
)

it.each([
    ['granted', 'granted'],
    ['denied', 'denied'],
    ['default', 'dismissed'],
] as const)('does not PUT when browser %s matches the server', async (permission, recorded) => {
    setBrowserPermission(permission)
    mockGetPreferences.mockResolvedValue(serverPreferences(recorded))
    const view = mount()
    await waitFor(() => expect(mockGetPreferences).toHaveBeenCalledTimes(1))
    await act(async () => {})
    view.rerender()
    await act(async () => {})
    expect(mockGetPreferences).toHaveBeenCalledTimes(1)
    expect(mockSavePreferences).not.toHaveBeenCalled()
})

it.each(['GET', 'PUT'])('bounds a failed %s to one attempt per app identity', async (boundary) => {
    if (boundary === 'GET') mockGetPreferences.mockRejectedValue(new Error('offline'))
    else mockSavePreferences.mockRejectedValue(new Error('offline'))
    const view = mount()
    await waitFor(() => expect(mockGetPreferences).toHaveBeenCalledTimes(1))
    await act(async () => {})
    for (let i = 0; i < 5; i++) view.rerender()
    await act(async () => {})
    expect(mockGetPreferences).toHaveBeenCalledTimes(1)
    expect(mockSavePreferences).toHaveBeenCalledTimes(boundary === 'GET' ? 0 : 1)
})

it('compares once for each authenticated identity and never writes as a signed-out visitor', async () => {
    mockUserId = null
    const view = mount()
    await act(async () => {})
    expect(mockGetPreferences).not.toHaveBeenCalled()
    expect(mockSavePreferences).not.toHaveBeenCalled()
    mockUserId = 'user-1'
    view.rerender()
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1))
    mockUserId = 'user-2'
    view.rerender()
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(2))
    view.rerender()
    await act(async () => {})
    expect(mockGetPreferences).toHaveBeenCalledTimes(2)
    expect(mockSavePreferences.mock.calls).toEqual([[{ pushPermission: 'granted' }], [{ pushPermission: 'granted' }]])
})

it.each(['unmount', 'signout', 'account change'])('ignores a late GET after %s', async (change) => {
    let resolveRead!: (value: unknown) => void
    mockGetPreferences.mockReturnValueOnce(
        new Promise((resolve) => {
            resolveRead = resolve
        })
    )
    const view = mount()
    await waitFor(() => expect(mockGetPreferences).toHaveBeenCalledTimes(1))
    if (change === 'unmount') view.unmount()
    else {
        mockUserId = change === 'signout' ? null : 'user-2'
        mockGetPreferences.mockResolvedValue(serverPreferences('granted'))
        view.rerender()
    }
    await act(async () => {
        resolveRead(serverPreferences('denied'))
    })
    expect(mockSavePreferences).not.toHaveBeenCalled()
})

it('uses browser permission even when SDK initialization is refused', async () => {
    mockAdapter.init.mockRejectedValue(new Error('Can only be used on: https://peanut.me'))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    mount()
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1))
    expect(mockSavePreferences).toHaveBeenCalledWith({ pushPermission: 'granted' })
})

it('does not invent a browser permission when Notification is unsupported', async () => {
    Reflect.deleteProperty(window, 'Notification')
    const view = mount()
    await waitFor(() => expect(view.result.current.oneSignalInitialized).toBe(true))
    await act(async () => {})
    expect(mockSavePreferences).not.toHaveBeenCalled()
})

it('waits for successful native initialization and reports adapter permission', async () => {
    mockNative = true
    Reflect.deleteProperty(window, 'Notification')
    let finishInit!: () => void
    mockAdapter.init.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            finishInit = resolve
        })
    )
    mockAdapter.getPermission.mockResolvedValue('granted')
    mount()
    await waitFor(() => expect(mockAdapter.init).toHaveBeenCalledTimes(1))
    expect(mockSavePreferences).not.toHaveBeenCalled()
    await act(async () => {
        finishInit()
    })
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1))
    expect(mockSavePreferences).toHaveBeenCalledWith({ pushPermission: 'granted' })
})

it('shares one comparison and PUT between simultaneous consumers', async () => {
    let resolveRead!: (value: unknown) => void
    mockGetPreferences.mockReturnValueOnce(
        new Promise((resolve) => {
            resolveRead = resolve
        })
    )
    const { useNotifications } = require('../useNotifications') as typeof import('../useNotifications')
    renderHook(() => {
        useNotifications()
        useNotifications()
    })
    await waitFor(() => expect(mockGetPreferences).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(mockGetPreferences).toHaveBeenCalledTimes(1)
    await act(async () => {
        resolveRead(serverPreferences('denied'))
    })
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1))
    expect(mockGetPreferences).toHaveBeenCalledTimes(1)
    expect(mockSavePreferences).toHaveBeenCalledWith({ pushPermission: 'granted' })
})

it('survives StrictMode effect replay with one comparison and one PUT', async () => {
    let resolveRead!: (value: unknown) => void
    mockGetPreferences.mockReturnValueOnce(
        new Promise((resolve) => {
            resolveRead = resolve
        })
    )
    const { useNotifications } = require('../useNotifications') as typeof import('../useNotifications')
    renderHook(() => useNotifications(), {
        wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(React.StrictMode, null, children),
    })
    await waitFor(() => expect(mockGetPreferences).toHaveBeenCalledTimes(1))
    await act(async () => {
        resolveRead(serverPreferences('denied'))
    })
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1))
    expect(mockGetPreferences).toHaveBeenCalledTimes(1)
    expect(mockSavePreferences).toHaveBeenCalledWith({ pushPermission: 'granted' })
})

it('reconciles native permission once after transient initialization recovers on an online edge', async () => {
    mockNative = true
    Reflect.deleteProperty(window, 'Notification')
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockAdapter.init.mockRejectedValueOnce(new Error('bridge unavailable')).mockResolvedValue(undefined)
    mockAdapter.getPermission.mockResolvedValue('granted')
    mockGetPreferences.mockResolvedValue(serverPreferences('denied'))
    const view = mount()
    await waitFor(() => expect(mockAdapter.init).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(view.result.current.oneSignalInitialized).toBe(false)
    expect(mockSavePreferences).not.toHaveBeenCalled()

    await act(async () => {
        window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(view.result.current.oneSignalInitialized).toBe(true))
    await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledTimes(1))
    expect(mockGetPreferences).toHaveBeenCalledTimes(1)
    expect(mockSavePreferences.mock.calls).toEqual([[{ pushPermission: 'granted' }]])

    view.rerender()
    await act(async () => {
        window.dispatchEvent(new Event('online'))
    })
    expect(mockAdapter.init).toHaveBeenCalledTimes(2)
    expect(mockGetPreferences).toHaveBeenCalledTimes(1)
    expect(mockSavePreferences).toHaveBeenCalledTimes(1)
})
