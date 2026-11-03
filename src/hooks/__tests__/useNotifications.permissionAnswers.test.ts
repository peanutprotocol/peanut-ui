jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, renderHook, waitFor } from '@testing-library/react'

// OneSignal's permissionChange carries a boolean, so a refusal (default → denied)
// never fired it and notification_permission_denied never reached PostHog. These
// pin that the answer comes from requestPermission() itself, once.
let mockPermissionListener: ((state: string) => void) | undefined
let mockNative = false
const mockAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn(),
    getPermission: jest.fn().mockResolvedValue('default'),
    isOptedIn: jest.fn().mockResolvedValue(false),
    onPermissionChange: jest.fn((listener: (state: string) => void) => {
        mockPermissionListener = listener
        return () => {}
    }),
    onSubscriptionChange: jest.fn(() => () => {}),
    onNotificationClick: jest.fn(() => () => {}),
    onNotificationReceived: jest.fn(() => () => {}),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: async () => mockAdapter }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: jest.fn(), updateUserPreferences: jest.fn() }))
jest.mock('@/hooks/useAppLocked', () => ({ useAppLocked: () => false }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))

import posthog from 'posthog-js'
import { resetPushPromptForTests, useNotifications } from '../useNotifications'

const ANSWERS = [
    'notification_permission_granted',
    'notification_permission_denied',
    'notification_permission_dismissed',
]
const answers = () =>
    (posthog.capture as jest.Mock).mock.calls
        .filter(([event]) => ANSWERS.includes(event))
        .map(([event, props]) => [event.replace('notification_permission_', ''), props])

const original = Object.getOwnPropertyDescriptor(window, 'Notification')
const browser = { permission: 'default' as NotificationPermission, requestPermission: jest.fn() }

async function renderReady() {
    const view = renderHook(() => useNotifications())
    await waitFor(() => expect(view.result.current.oneSignalInitialized).toBe(true))
    return view
}

beforeAll(() => {
    Object.defineProperty(window, 'Notification', { configurable: true, value: browser })
})
afterAll(() => {
    if (original) Object.defineProperty(window, 'Notification', original)
    else Reflect.deleteProperty(window, 'Notification')
})
beforeEach(() => {
    mockNative = false
    browser.permission = 'default'
    browser.requestPermission.mockReset()
    act(() => resetPushPromptForTests())
    ;(posthog.capture as jest.Mock).mockClear()
})

describe('web', () => {
    it.each([
        ['denied', 'denied'],
        ['default', 'dismissed'],
    ] as const)('reports a %s answer to the prompt as %s, with its trigger', async (answer, event) => {
        browser.requestPermission.mockResolvedValue(answer)
        const view = await renderReady()
        await act(async () => {
            await view.result.current.requestPermission('signup')
        })
        expect(answers()).toEqual([[event, { trigger: 'signup', via: 'request', previous_permission: 'default' }]])
    })

    it('counts a grant once although OneSignal then reports the same permission', async () => {
        browser.requestPermission.mockResolvedValue('granted')
        const view = await renderReady()
        await act(async () => {
            await view.result.current.requestPermission('signup')
        })
        await act(async () => mockPermissionListener?.('granted'))
        expect(answers()).toEqual([['granted', { trigger: 'signup', via: 'request', previous_permission: 'default' }]])
    })

    it('sends no answer when the permission was already granted, and still reports a tap that was already blocked', async () => {
        const view = await renderReady()
        browser.permission = 'granted'
        await act(async () => {
            await view.result.current.requestPermission('settings')
        })
        expect(answers()).toEqual([])
        browser.permission = 'denied'
        await act(async () => {
            await view.result.current.requestPermission('settings')
        })
        expect(browser.requestPermission).not.toHaveBeenCalled()
        expect(answers()).toEqual([['denied', { trigger: 'settings', via: 'request', previous_permission: 'denied' }]])
    })

    it('reports a change made outside an ask, such as in the browser settings', async () => {
        browser.requestPermission.mockResolvedValue('granted')
        const view = await renderReady()
        await act(async () => {
            await view.result.current.requestPermission('signup')
        })
        await act(async () => mockPermissionListener?.('denied'))
        expect(answers()).toEqual([
            ['granted', { trigger: 'signup', via: 'request', previous_permission: 'default' }],
            ['denied', { trigger: null, via: 'change', previous_permission: 'granted' }],
        ])
    })
})

describe('native', () => {
    beforeEach(() => {
        mockNative = true
    })

    it('reports a refusal from the returned answer, which OneSignal never reports itself', async () => {
        mockAdapter.requestPermission.mockResolvedValueOnce('denied')
        const view = await renderReady()
        await act(async () => {
            await view.result.current.requestPermission('signup')
        })
        expect(answers()).toEqual([['denied', { trigger: 'signup', via: 'request', previous_permission: 'default' }]])
    })

    it('counts a grant once when OneSignal reports it while the request is still open', async () => {
        const view = await renderReady()
        mockAdapter.requestPermission.mockImplementationOnce(async () => {
            mockPermissionListener?.('granted')
            return 'granted'
        })
        await act(async () => {
            await view.result.current.requestPermission('home_carousel')
        })
        expect(answers()).toEqual([
            ['granted', { trigger: 'home_carousel', via: 'request', previous_permission: 'default' }],
        ])
    })
})
