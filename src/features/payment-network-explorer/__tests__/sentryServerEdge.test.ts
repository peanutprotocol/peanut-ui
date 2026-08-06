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
        expect(beforeSendRouteAwareHandler({ message: 'real error' } as ErrorEvent)).toEqual({
            message: 'real error',
        })
    })

    it.each(['sentry.server.config', 'sentry.edge.config'])('wires both route-aware hooks in %s', (moduleName) => {
        const previousNodeEnv = process.env.NODE_ENV
        Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'production' })
        mockSentryInit.mockClear()
        jest.isolateModules(() => {
            require(`../../../../${moduleName}.ts`)
        })
        Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: previousNodeEnv })

        const options = mockSentryInit.mock.calls[0]?.[0]
        expect(options?.beforeSend).toEqual(expect.any(Function))
        expect(options?.beforeSendTransaction).toEqual(expect.any(Function))
        expect(options?.beforeSend({ request: { url: '/dev/payment-graph?password=marker' } })).toBeNull()
        expect(options?.beforeSendTransaction({ transaction: 'GET /home' })).toEqual({ transaction: 'GET /home' })
    })
})
