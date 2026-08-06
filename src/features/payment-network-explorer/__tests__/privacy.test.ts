import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import {
    disablePaymentNetworkGoogleAnalytics,
    googleAnalyticsBootstrapScript,
    isPaymentNetworkExplorerPath,
} from '../privacy-route'
import { resetPaymentNetworkTelemetryGuardForTest, suppressPaymentNetworkTelemetry } from '../privacy'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        stopSessionRecording: jest.fn(),
        set_config: jest.fn(),
        opt_out_capturing: jest.fn(),
    },
}))

const stopReplay = jest.fn().mockResolvedValue(undefined)
const closeClient = jest.fn().mockResolvedValue(undefined)

const storageSnapshot = (storage: Storage): Record<string, string | null> =>
    Object.fromEntries(
        Array.from({ length: storage.length }, (_, index) => {
            const key = storage.key(index)!
            return [key, storage.getItem(key)]
        })
    )

jest.mock('@sentry/nextjs', () => ({
    getClient: jest.fn(() => ({
        getIntegrationByName: jest.fn(() => ({ stop: stopReplay })),
        close: closeClient,
    })),
}))

describe('payment explorer privacy boundary', () => {
    beforeEach(() => {
        resetPaymentNetworkTelemetryGuardForTest()
        jest.clearAllMocks()
        window.localStorage.clear()
        window.sessionStorage.clear()
        window.localStorage.setItem('existing-local', 'keep')
        window.sessionStorage.setItem('existing-session', 'keep')
        document.cookie = 'existing-cookie=keep; path=/'
        delete (window as unknown as Window & Record<string, unknown>)['ga-disable-G-QATEST']
    })

    it('recognizes only the dedicated explorer route', () => {
        expect(isPaymentNetworkExplorerPath('/dev/payment-graph')).toBe(true)
        expect(isPaymentNetworkExplorerPath('/dev/payment-graph/')).toBe(true)
        expect(isPaymentNetworkExplorerPath('/dev/full-graph')).toBe(false)
        expect(isPaymentNetworkExplorerPath('/dev/payment-graphical')).toBe(false)
    })

    it('stops capture and replay without persisting an analytics opt-out', () => {
        const localBefore = storageSnapshot(window.localStorage)
        const sessionBefore = storageSnapshot(window.sessionStorage)
        const cookieBefore = document.cookie
        suppressPaymentNetworkTelemetry('/dev/payment-graph')

        expect(posthog.stopSessionRecording).toHaveBeenCalledTimes(1)
        expect(posthog.set_config).toHaveBeenCalledWith({
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            disable_session_recording: true,
        })
        expect(Sentry.getClient).toHaveBeenCalledTimes(1)
        expect(stopReplay).toHaveBeenCalledTimes(1)
        expect(closeClient).toHaveBeenCalledWith(0)
        expect(storageSnapshot(window.localStorage)).toEqual(localBefore)
        expect(storageSnapshot(window.sessionStorage)).toEqual(sessionBefore)
        expect(localBefore).toEqual({ 'existing-local': 'keep' })
        expect(sessionBefore).toEqual({ 'existing-session': 'keep' })
        expect(document.cookie).toBe(cookieBefore)
        expect(posthog.opt_out_capturing).not.toHaveBeenCalled()
        expect(posthog.set_config).not.toHaveBeenCalledWith(
            expect.objectContaining({ opt_out_capturing_by_default: true })
        )
    })

    it('does nothing outside the explorer and is idempotent inside it', () => {
        suppressPaymentNetworkTelemetry('/home')
        expect(posthog.set_config).not.toHaveBeenCalled()
        suppressPaymentNetworkTelemetry('/dev/payment-graph')
        suppressPaymentNetworkTelemetry('/dev/payment-graph')
        expect(posthog.set_config).toHaveBeenCalledTimes(1)
    })

    it('sets the GA kill switch for direct and client-navigation explorer paths', () => {
        disablePaymentNetworkGoogleAnalytics('/home', 'G-QATEST')
        expect((window as unknown as Window & Record<string, unknown>)['ga-disable-G-QATEST']).toBeUndefined()
        disablePaymentNetworkGoogleAnalytics('/dev/payment-graph', 'G-QATEST')
        expect((window as unknown as Window & Record<string, unknown>)['ga-disable-G-QATEST']).toBe(true)
    })

    it('does not load or configure Google Analytics on a direct legacy URL', () => {
        window.history.replaceState({}, '', '/dev/payment-graph?user=alice&password=marker')
        const append = jest.spyOn(document.head, 'appendChild')
        const script = googleAnalyticsBootstrapScript('G-QATEST')
        new Function('window', 'document', 'location', script)(window, document, window.location)

        expect((window as unknown as Window & Record<string, unknown>)['ga-disable-G-QATEST']).toBe(true)
        expect(append).not.toHaveBeenCalled()
        append.mockRestore()
        window.history.replaceState({}, '', '/')
    })
})
