import { reportChunkReloadRecovery } from '../chunk-reload-report'
import * as Sentry from '@/utils/sentry-lazy'
import posthog from 'posthog-js'

jest.mock('@/utils/sentry-lazy', () => ({ withScope: jest.fn(), captureMessage: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const key = 'peanut-chunk-reload-report'
const now = 1_800_000_000_000
const marker = { at: now - 2500, source: 'inline', path: '/send', message: 'Loading chunk 42 failed' }
const scope = {
    setTag: jest.fn(),
    setExtra: jest.fn(),
    setContext: jest.fn(),
    setFingerprint: jest.fn(),
    setLevel: jest.fn(),
}
const capture = posthog.capture as jest.Mock
const withScope = Sentry.withScope as jest.Mock

describe('reportChunkReloadRecovery', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.setSystemTime(now)
        jest.resetAllMocks()
        sessionStorage.clear()
        withScope.mockImplementation((callback: (value: typeof scope) => void) => callback(scope))
    })

    afterEach(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    it.each(['inline', 'boundary'])('consumes and reports %s once before either telemetry channel runs', (source) => {
        sessionStorage.setItem(key, JSON.stringify({ ...marker, source }))
        capture.mockImplementation(() => {
            expect(sessionStorage.getItem(key)).toBeNull()
            reportChunkReloadRecovery()
        })
        reportChunkReloadRecovery()
        reportChunkReloadRecovery()
        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture).toHaveBeenCalledWith('chunk_reload_recovered', {
            source,
            path: '/send',
            error_message: marker.message,
            reload_ms: 2500,
        })
        expect(Sentry.captureMessage).toHaveBeenCalledWith('Chunk load error recovered by reload', 'warning')
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
        expect(scope.setTag).toHaveBeenCalledWith('chunk_reload.source', source)
        expect(scope.setTag).toHaveBeenCalledWith('chunk_reload.path', '/send')
        expect(scope.setFingerprint).toHaveBeenCalledWith(['chunk-reload-recovered'])
        const metadata = [
            ...scope.setExtra.mock.calls.map((call) => call[1]),
            ...scope.setContext.mock.calls.map((call) => call[1]),
        ]
        const values = metadata.flatMap((value) =>
            value && typeof value === 'object' ? Object.values(value) : [value]
        )
        expect(values).toContain(marker.message)
        expect(values).toContain(2.5)
    })

    it.each([
        ['malformed', '{'],
        ['null', 'null'],
        ['array', '[]'],
        ['missing field', JSON.stringify({ at: now })],
        ['timestamp type', JSON.stringify({ ...marker, at: '123' })],
        ['timestamp null', JSON.stringify({ ...marker, at: null })],
        ['timestamp infinite', '{"at":1e999,"path":"/","source":"inline","message":"x"}'],
        ['path type', JSON.stringify({ ...marker, path: 42 })],
        ['source', JSON.stringify({ ...marker, source: 'other' })],
        ['message type', JSON.stringify({ ...marker, message: {} })],
        ['stale', JSON.stringify({ ...marker, at: now - 300001 })],
    ])('clears and ignores %s', (_label, raw) => {
        sessionStorage.setItem(key, raw)
        expect(() => reportChunkReloadRecovery()).not.toThrow()
        expect(sessionStorage.getItem(key)).toBeNull()
        expect(capture).not.toHaveBeenCalled()
        expect(Sentry.captureMessage).not.toHaveBeenCalled()
    })

    it('accepts exactly five minutes', () => {
        sessionStorage.setItem(key, JSON.stringify({ ...marker, at: now - 300000 }))
        reportChunkReloadRecovery()
        expect(capture).toHaveBeenCalledWith('chunk_reload_recovered', expect.objectContaining({ reload_ms: 300000 }))
    })

    it('does nothing without a marker', () => {
        reportChunkReloadRecovery()
        expect(withScope).not.toHaveBeenCalled()
        expect(capture).not.toHaveBeenCalled()
    })

    it.each(['getItem', 'removeItem'] as const)('contains storage %s failures', (method) => {
        sessionStorage.setItem(key, JSON.stringify(marker))
        jest.spyOn(Storage.prototype, method).mockImplementation(() => {
            throw new Error('denied')
        })
        expect(() => reportChunkReloadRecovery()).not.toThrow()
    })

    it('continues to PostHog when Sentry fails', () => {
        sessionStorage.setItem(key, JSON.stringify(marker))
        withScope.mockImplementation(() => {
            throw new Error('Sentry unavailable')
        })
        expect(() => reportChunkReloadRecovery()).not.toThrow()
        expect(capture).toHaveBeenCalledTimes(1)
    })

    it('contains PostHog failure and still reports to Sentry once', () => {
        sessionStorage.setItem(key, JSON.stringify(marker))
        capture.mockImplementation(() => {
            throw new Error('PostHog unavailable')
        })
        expect(() => reportChunkReloadRecovery()).not.toThrow()
        reportChunkReloadRecovery()
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
        expect(capture).toHaveBeenCalledTimes(1)
    })
})
