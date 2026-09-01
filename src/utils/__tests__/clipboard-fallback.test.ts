// copyTextToClipboardWithFallback must report whether the copy landed: the Capacitor WebView
// rejects writeText (NotAllowedError) and Brave iOS never settles it, and both used to leave
// the caller believing the copy worked.
import * as Sentry from '@sentry/nextjs'
import { copyTextToClipboardWithFallback } from '../general.utils'

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
// general.utils reports through the lazy wrapper; aliasing it to the mock keeps the calls synchronous.
jest.mock('@/utils/sentry-lazy', () => require('@sentry/nextjs'))

const writeText = jest.fn()
const execCommand = jest.fn()

describe('copyTextToClipboardWithFallback', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
        document.execCommand = execCommand
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('returns true when the Clipboard API succeeds, without touching the fallback', async () => {
        writeText.mockResolvedValue(undefined)
        await expect(copyTextToClipboardWithFallback('x')).resolves.toBe(true)
        expect(execCommand).not.toHaveBeenCalled()
        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('falls back to execCommand when writeText rejects and reports the rejection', async () => {
        writeText.mockRejectedValue(new Error('NotAllowedError'))
        execCommand.mockReturnValue(true)
        await expect(copyTextToClipboardWithFallback('x')).resolves.toBe(true)
        expect(execCommand).toHaveBeenCalledWith('copy')
        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    })

    it('falls back when writeText never settles', async () => {
        writeText.mockReturnValue(new Promise(() => {}))
        execCommand.mockReturnValue(true)
        const result = copyTextToClipboardWithFallback('x')
        await jest.advanceTimersByTimeAsync(1000)
        await expect(result).resolves.toBe(true)
        expect(execCommand).toHaveBeenCalledWith('copy')
        expect((Sentry.captureException as jest.Mock).mock.calls[0][0].message).toContain('timed out')
    })

    it('returns false and reports when both paths fail', async () => {
        writeText.mockRejectedValue(new Error('nope'))
        execCommand.mockReturnValue(false)
        await expect(copyTextToClipboardWithFallback('x')).resolves.toBe(false)
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    })

    it('returns false and leaves no textarea behind when execCommand throws', async () => {
        writeText.mockRejectedValue(new Error('nope'))
        execCommand.mockImplementation(() => {
            throw new Error('execCommand unsupported')
        })
        await expect(copyTextToClipboardWithFallback('secret')).resolves.toBe(false)
        expect(document.querySelector('textarea')).toBeNull()
        expect(Sentry.captureException).toHaveBeenCalledTimes(2)
    })
})
