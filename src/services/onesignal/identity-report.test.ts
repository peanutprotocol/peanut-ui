import { captureException } from '@/utils/sentry-lazy'
import { isCapacitor } from '@/utils/capacitor'
import { collectPushSdkDiagnostics } from './web-diagnostics'

jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))
jest.mock('./web-diagnostics', () => ({ collectPushSdkDiagnostics: jest.fn() }))

const capture = captureException as jest.Mock
const native = isCapacitor as jest.Mock
const diagnostics = collectPushSdkDiagnostics as jest.Mock
let reportPushIdentityFailure: typeof import('./identity-report').reportPushIdentityFailure
let PushIdentityTimeoutError: typeof import('./identity-sync').PushIdentityTimeoutError

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
        jest.isolateModules(() => {
            ;({ reportPushIdentityFailure } = require('./identity-report'))
            ;({ PushIdentityTimeoutError } = require('./identity-sync'))
        })
        capture.mockClear()
        diagnostics.mockReset().mockResolvedValue({ worker: 'none', database: 'ok:v7' })
        native.mockReturnValue(false)
        setPermission(undefined)
    })

    it.each([
        ['no Notification API (iOS Safari tab)', undefined],
        ['permission never granted', 'default' as const],
        ['permission denied', 'denied' as const],
    ])('stays silent on the web with %s', async (_label, permission) => {
        setPermission(permission)
        await reportPushIdentityFailure(
            'Push identity reconciliation failed',
            'push_identity_reconcile',
            new Error('x')
        )
        expect(capture).not.toHaveBeenCalled()
    })

    it('reports on the web once push permission is granted, with the underlying error', async () => {
        setPermission('granted')
        const failure = new TypeError('Failed to fetch')
        await reportPushIdentityFailure('Push identity reconciliation failed', 'push_identity_reconcile', failure)
        expect(capture).toHaveBeenCalledWith(new Error('Push identity reconciliation failed'), {
            tags: { source: 'push_identity_reconcile', cause: 'error', cause_name: 'TypeError' },
            extra: {
                causeMessage: 'Failed to fetch',
                causeStack: expect.stringContaining('TypeError: Failed to fetch'),
            },
        })
    })

    it('reports in the native app regardless of web permission', async () => {
        native.mockReturnValue(true)
        await reportPushIdentityFailure(
            'Push identity login failed',
            'push_identity_login',
            new PushIdentityTimeoutError()
        )
        expect(capture).toHaveBeenCalledWith(new Error('Push identity login failed'), {
            tags: { source: 'push_identity_login', cause: 'timeout', cause_name: 'PushIdentityTimeoutError' },
            extra: { causeMessage: 'Push identity operation timed out', causeStack: expect.any(String) },
        })
        expect(diagnostics).not.toHaveBeenCalled()
    })

    it('attaches the stalled stage and the web SDK state to a web timeout', async () => {
        setPermission('granted')
        await reportPushIdentityFailure(
            'Push identity reconciliation failed',
            'push_identity_reconcile',
            new PushIdentityTimeoutError(undefined, 'init')
        )
        expect(capture).toHaveBeenCalledWith(new Error('Push identity reconciliation failed'), {
            tags: {
                source: 'push_identity_reconcile',
                cause: 'timeout',
                cause_name: 'PushIdentityTimeoutError',
                stage: 'init',
            },
            extra: {
                causeMessage: 'Push identity operation timed out',
                causeStack: expect.any(String),
                sdk: { worker: 'none', database: 'ok:v7' },
            },
        })
    })

    it('reports the same stall once per page, however often the write is retried', async () => {
        setPermission('granted')
        const stalled = () => new PushIdentityTimeoutError(undefined, 'init')
        await reportPushIdentityFailure('Push identity reconciliation failed', 'push_identity_reconcile', stalled())
        await reportPushIdentityFailure('Push identity reconciliation failed', 'push_identity_reconcile', stalled())
        await reportPushIdentityFailure(
            'Push identity reconciliation failed',
            'push_identity_reconcile',
            new PushIdentityTimeoutError(undefined, 'login')
        )
        await reportPushIdentityFailure('Push identity login failed', 'push_identity_login', stalled())
        expect(capture).toHaveBeenCalledTimes(3)
        expect(capture.mock.calls.map(([, context]) => [context.tags.source, context.tags.stage])).toEqual([
            ['push_identity_reconcile', 'init'],
            ['push_identity_reconcile', 'login'],
            ['push_identity_login', 'init'],
        ])
    })

    it('keeps the wrapper as the only exception so the noise filter cannot drop it', async () => {
        native.mockReturnValue(true)
        await reportPushIdentityFailure(
            'Push identity login failed',
            'push_identity_login',
            new TypeError('Failed to fetch')
        )
        const [reported] = capture.mock.calls[0]
        expect(reported.cause).toBeUndefined()
    })

    it('keeps the payload of a non-Error rejection', async () => {
        native.mockReturnValue(true)
        await reportPushIdentityFailure('Push identity login failed', 'push_identity_login', { status: 409 })
        expect(capture.mock.calls[0][1].extra.causeMessage).toBe('{"status":409}')
    })

    it('trims the cause stack', async () => {
        native.mockReturnValue(true)
        const failure = new Error('deep')
        failure.stack = ['Error: deep', ...Array.from({ length: 20 }, (_, i) => `    at frame${i}`)].join('\n')
        await reportPushIdentityFailure('Push identity login failed', 'push_identity_login', failure)
        expect(capture.mock.calls[0][1].extra.causeStack.split('\n')).toHaveLength(6)
    })
})
