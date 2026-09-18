import type { ErrorEvent } from '@sentry/nextjs'
import {
    beforeSendRouteAwareHandler,
    beforeSendRouteAwareTransaction,
    isPaymentNetworkSentryEvent,
} from '../../../../sentry.utils'

const mockSentryInit = jest.fn()

jest.mock('@sentry/nextjs', () => ({
    init: mockSentryInit,
    captureConsoleIntegration: jest.fn(() => ({ name: 'console' })),
}))

describe('server and edge payment explorer Sentry guard', () => {
    it.each([
        'https://peanut.me/dev/payment-graph?user=marker-user&password=marker-password',
        'https://peanut.me/dev/payment-graph?focus=marker-focus',
        '/dev/payment-graph?focus=marker-focus',
    ])('drops an error event carrying a sensitive explorer URL: %s', (url) => {
        const event = { request: { url }, message: 'marker error' } as ErrorEvent
        expect(isPaymentNetworkSentryEvent(event)).toBe(true)
        expect(beforeSendRouteAwareHandler(event)).toBeNull()
    })

    it('drops route-named transactions and preserves unrelated telemetry', () => {
        const privateTransaction = { transaction: 'GET /dev/payment-graph?focus=marker-focus' }
        const normalTransaction = { transaction: 'GET /home', request: { url: 'https://peanut.me/home' } }
        expect(beforeSendRouteAwareTransaction(privateTransaction)).toBeNull()
        expect(beforeSendRouteAwareTransaction(normalTransaction)).toBe(normalTransaction)
        // jsdom exposes navigator.onLine, so the kept event gains the ambient
        // browser connectivity tag; the server/edge shape is the case below.
        expect(beforeSendRouteAwareHandler({ message: 'real error' } as ErrorEvent)).toEqual({
            message: 'real error',
            tags: { net_online: 'true' },
        })
    })

    it('leaves kept events untagged when the runtime has no navigator.onLine (server/edge)', () => {
        // Node and the Vercel edge runtime expose a navigator without onLine —
        // model that by shadowing jsdom's prototype getter with undefined.
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: undefined })
        try {
            expect(beforeSendRouteAwareHandler({ message: 'real error' } as ErrorEvent)).toEqual({
                message: 'real error',
            })
        } finally {
            delete (navigator as { onLine?: boolean }).onLine
        }
    })

    const loadConfig = (moduleName: string, vercelEnv: string) => {
        const previousNodeEnv = process.env.NODE_ENV
        const previousVercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
        const setNodeEnv = (value: string | undefined) =>
            Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value, writable: true })
        setNodeEnv('production')
        process.env.NEXT_PUBLIC_VERCEL_ENV = vercelEnv
        mockSentryInit.mockClear()
        try {
            jest.isolateModules(() => {
                require(`../../../../${moduleName}.ts`)
            })
        } finally {
            setNodeEnv(previousNodeEnv)
            if (previousVercelEnv === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV
            else process.env.NEXT_PUBLIC_VERCEL_ENV = previousVercelEnv
        }
        return mockSentryInit.mock.calls[0]?.[0]
    }

    // A PR preview reports into the production project, where nobody triages it.
    it.each(['sentry.server.config', 'sentry.edge.config'])('does not init on a preview in %s', (moduleName) => {
        expect(loadConfig(moduleName, 'preview')).toBeUndefined()
    })

    it.each(['sentry.server.config', 'sentry.edge.config'])('wires both route-aware hooks in %s', (moduleName) => {
        const options = loadConfig(moduleName, 'production')
        expect(options?.beforeSend).toEqual(expect.any(Function))
        expect(options?.beforeSendTransaction).toEqual(expect.any(Function))
        expect(options?.beforeSend({ request: { url: '/dev/payment-graph?password=marker' } })).toBeNull()
        expect(options?.beforeSendTransaction({ transaction: 'GET /home' })).toEqual({ transaction: 'GET /home' })
    })
})
