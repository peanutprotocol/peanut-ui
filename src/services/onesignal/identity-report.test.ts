import { reportPushIdentityFailure } from './identity-report'
import { PushIdentityTimeoutError } from './identity-sync'
import { captureException } from '@/utils/sentry-lazy'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))

const capture = captureException as jest.Mock
const native = isCapacitor as jest.Mock

function setPermission(permission: NotificationPermission | undefined) {
    if (permission === undefined) {
        delete (globalThis as { Notification?: unknown }).Notification
        return
    }
    Object.defineProperty(globalThis, 'Notification', {
        configurable: true,
        writable: true,
        value: { permission },
    })
}

describe('reportPushIdentityFailure', () => {
    beforeEach(() => {
        capture.mockClear()
        native.mockReturnValue(false)
        setPermission(undefined)
    })

    it.each([
        ['no Notification API (iOS Safari tab)', undefined],
        ['permission never granted', 'default' as const],
        ['permission denied', 'denied' as const],
    ])('stays silent on the web with %s', (_label, permission) => {
        setPermission(permission)
        reportPushIdentityFailure('Push identity reconciliation failed', 'push_identity_reconcile', new Error('x'))
        expect(capture).not.toHaveBeenCalled()
    })

    it('reports on the web once push permission is granted', () => {
        setPermission('granted')
        reportPushIdentityFailure('Push identity reconciliation failed', 'push_identity_reconcile', new Error('x'))
        expect(capture).toHaveBeenCalledWith(new Error('Push identity reconciliation failed'), {
            tags: { source: 'push_identity_reconcile', cause: 'error' },
        })
    })

    it('reports in the native app regardless of web permission', () => {
        native.mockReturnValue(true)
        reportPushIdentityFailure('Push identity login failed', 'push_identity_login', new PushIdentityTimeoutError())
        expect(capture).toHaveBeenCalledWith(new Error('Push identity login failed'), {
            tags: { source: 'push_identity_login', cause: 'timeout' },
        })
    })
})
