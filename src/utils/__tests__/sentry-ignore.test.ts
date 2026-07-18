import type { ErrorEvent } from '@sentry/nextjs'

import { shouldIgnoreError } from '../../../sentry.utils'

function eventWithMessage(message: string): ErrorEvent {
    return { type: undefined, message } as ErrorEvent
}

function eventWithException(type: string, value: string): ErrorEvent {
    return { type: undefined, exception: { values: [{ type, value }] } } as ErrorEvent
}

describe('shouldIgnoreError — Capacitor plugin-not-implemented iframe noise (PEANUT-UI-QV3)', () => {
    it('ignores "StatusBar" plugin not implemented on ios', () => {
        expect(shouldIgnoreError(eventWithMessage('"StatusBar" plugin is not implemented on ios'))).toBe(true)
    })

    it('ignores other plugin variants from the same iframe (Keyboard, App)', () => {
        expect(shouldIgnoreError(eventWithMessage('"Keyboard" plugin is not implemented on ios'))).toBe(true)
        expect(shouldIgnoreError(eventWithMessage('"App" plugin is not implemented on android'))).toBe(true)
        expect(shouldIgnoreError(eventWithMessage('"StatusBar" plugin is not implemented on web'))).toBe(true)
    })

    it('matches when the message lives in exception values instead of event.message', () => {
        expect(shouldIgnoreError(eventWithException('Error', '"StatusBar" plugin is not implemented on ios'))).toBe(
            true
        )
    })

    it('does not match a plugin error that IS implemented-related but differently worded', () => {
        expect(shouldIgnoreError(eventWithMessage('StatusBar plugin failed to initialize'))).toBe(false)
    })

    it('still reports unrelated errors', () => {
        expect(shouldIgnoreError(eventWithMessage('Cannot read properties of undefined'))).toBe(false)
    })
})

describe('shouldIgnoreError — existing string patterns still work', () => {
    it('ignores user rejections', () => {
        expect(shouldIgnoreError(eventWithMessage('User rejected the request'))).toBe(true)
    })

    it('ignores extension noise via stack frames', () => {
        const event = {
            type: undefined,
            exception: {
                values: [
                    {
                        type: 'TypeError',
                        value: 'boom',
                        stacktrace: { frames: [{ filename: 'chrome-extension://abc/content.js' }] },
                    },
                ],
            },
        } as unknown as ErrorEvent
        expect(shouldIgnoreError(event)).toBe(true)
    })
})
