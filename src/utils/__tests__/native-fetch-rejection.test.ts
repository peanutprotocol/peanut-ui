import type { CaptureResult } from 'posthog-js'
import { isNativeFetchRejection, isNativeFetchRejectionExceptionEvent } from '../native-fetch-rejection'

describe('isNativeFetchRejection', () => {
    test.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])(
        'matches TypeError with engine message %p',
        (message) => {
            expect(isNativeFetchRejection('TypeError', message)).toBe(true)
        }
    )

    test('rejects our own wrapped copy that merely contains the engine string', () => {
        expect(isNativeFetchRejection('Error', 'Failed to fetch charges: 500')).toBe(false)
        expect(isNativeFetchRejection('TypeError', 'Failed to fetch charges: 500')).toBe(false)
        expect(isNativeFetchRejection(undefined, undefined)).toBe(false)
    })
})

function exceptionEvent(list: unknown): CaptureResult {
    return { event: '$exception', properties: { $exception_list: list } } as unknown as CaptureResult
}

describe('isNativeFetchRejectionExceptionEvent', () => {
    test('drops the autocaptured WebKit blip', () => {
        expect(
            isNativeFetchRejectionExceptionEvent(exceptionEvent([{ type: 'TypeError', value: 'Load failed' }]))
        ).toBe(true)
    })

    test('drops only when every exception in the chain matches', () => {
        expect(
            isNativeFetchRejectionExceptionEvent(
                exceptionEvent([
                    { type: 'TypeError', value: 'Load failed' },
                    { type: 'Error', value: 'Something went wrong' },
                ])
            )
        ).toBe(false)
    })

    test('passes through everything uncertain', () => {
        expect(isNativeFetchRejectionExceptionEvent(null)).toBe(false)
        expect(
            isNativeFetchRejectionExceptionEvent({ event: 'send_failed', properties: {} } as unknown as CaptureResult)
        ).toBe(false)
        expect(isNativeFetchRejectionExceptionEvent(exceptionEvent(undefined))).toBe(false)
        expect(isNativeFetchRejectionExceptionEvent(exceptionEvent([]))).toBe(false)
        expect(
            isNativeFetchRejectionExceptionEvent(
                exceptionEvent([{ type: 'TypeError', value: 'Failed to fetch charges: 500' }])
            )
        ).toBe(false)
    })
})
