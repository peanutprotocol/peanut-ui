import { collectPushSdkDiagnostics, webInitProgress } from './web-diagnostics'

type OpenRequest = {
    result?: { version: number; close: jest.Mock }
    error?: { name: string }
    transaction?: { abort: jest.Mock }
    onupgradeneeded?: () => void
    onblocked?: () => void
    onerror?: () => void
    onsuccess?: () => void
}

function installIndexedDb(names: string[], respond: (request: OpenRequest) => void) {
    const open = jest.fn((_name: string, version?: number) => {
        const request: OpenRequest = {}
        setTimeout(() => respond(request), 0)
        expect(version).toBeUndefined()
        return request
    })
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: { databases: jest.fn(async () => names.map((name) => ({ name, version: 7 }))), open },
    })
    return open
}

function installWorkers(registrations: Array<Partial<ServiceWorkerRegistration>>) {
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { getRegistrations: jest.fn(async () => registrations), controller: null },
    })
}

describe('collectPushSdkDiagnostics', () => {
    afterEach(() => {
        delete (globalThis as { OneSignal?: unknown }).OneSignal
    })

    it('reports a stuck worker install and a healthy database without leaving the database open', async () => {
        const close = jest.fn()
        installIndexedDb(['ONE_SIGNAL_SDK_DB'], (request) => {
            request.result = { version: 7, close }
            request.onsuccess?.()
        })
        installWorkers([
            {
                scope: 'https://staging.peanut.me/',
                installing: null,
                waiting: null,
                active: { state: 'activated' } as ServiceWorker,
            },
            {
                scope: 'https://staging.peanut.me/onesignal/',
                installing: { state: 'installing' } as ServiceWorker,
                waiting: null,
                active: null,
            },
        ])
        ;(globalThis as { OneSignal?: unknown }).OneSignal = { config: { appId: 'x' } }
        webInitProgress.started()

        const result = await collectPushSdkDiagnostics()

        expect(result).toMatchObject({
            worker: 'installing:installing waiting:- active:-',
            database: 'ok:v7',
            sdkLoaded: true,
            sdkConfigLoaded: true,
            initStartedAt: expect.any(Number),
        })
        expect(close).toHaveBeenCalled()
    })

    it('never creates the SDK database when it does not exist yet', async () => {
        const open = installIndexedDb([], () => {})
        installWorkers([])
        const result = await collectPushSdkDiagnostics()
        expect(result).toMatchObject({ database: 'absent', worker: 'none', sdkLoaded: false })
        expect(open).not.toHaveBeenCalled()
    })

    it('aborts the open if the database disappeared before it, so no empty version is created', async () => {
        const abort = jest.fn()
        Object.defineProperty(globalThis, 'indexedDB', {
            configurable: true,
            value: {
                open: jest.fn(() => {
                    const request: OpenRequest = { transaction: { abort } }
                    setTimeout(() => request.onupgradeneeded?.(), 0)
                    return request
                }),
            },
        })
        installWorkers([])
        expect(await collectPushSdkDiagnostics()).toMatchObject({ database: 'absent' })
        expect(abort).toHaveBeenCalled()
    })

    it('names a blocked database and still settles when a probe hangs', async () => {
        installIndexedDb(['ONE_SIGNAL_SDK_DB'], (request) => request.onblocked?.())
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: { getRegistrations: () => new Promise(() => {}), controller: null },
        })
        expect(await collectPushSdkDiagnostics(50)).toMatchObject({ database: 'blocked', worker: 'timeout' })
    })
})
