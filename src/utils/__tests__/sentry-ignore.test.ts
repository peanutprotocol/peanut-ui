import type { ErrorEvent } from '@sentry/nextjs'

import { shouldIgnoreError } from '../../../sentry.utils'

function eventWithMessage(message: string): ErrorEvent {
    return { type: undefined, message } as ErrorEvent
}

function eventWithException(type: string, value: string): ErrorEvent {
    return { type: undefined, exception: { values: [{ type, value }] } } as ErrorEvent
}

describe('shouldIgnoreError — per-field matching', () => {
    it('matches a pattern contained in event.message', () => {
        expect(shouldIgnoreError(eventWithMessage('User rejected the request'))).toBe(true)
    })

    it('matches a pattern contained in an exception value', () => {
        expect(shouldIgnoreError(eventWithException('Error', 'MetaMask: user rejected signature'))).toBe(true)
    })

    it('matches case-insensitively', () => {
        expect(shouldIgnoreError(eventWithMessage('USER REJECTED the request'))).toBe(true)
    })

    it('does not match across field boundaries (message + exception value concatenation)', () => {
        // 'User rejected' split across two fields: the old concatenated-blob
        // matching would have suppressed this unrelated event.
        const event = {
            type: undefined,
            message: 'Signing failed for User',
            exception: { values: [{ type: 'Error', value: 'rejected promise left unhandled' }] },
        } as unknown as ErrorEvent
        expect(shouldIgnoreError(event)).toBe(false)
    })

    it('still reports unrelated errors', () => {
        expect(shouldIgnoreError(eventWithMessage('Cannot read properties of undefined'))).toBe(false)
    })
})

describe('shouldIgnoreError — existing patterns intact', () => {
    it('ignores network noise', () => {
        expect(shouldIgnoreError(eventWithException('TypeError', 'Failed to fetch'))).toBe(true)
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
