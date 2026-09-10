import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import ShareButton from '../index'
import { renderWithIntl } from '@/test-utils/intl'

const mockToastInfo = jest.fn()
const mockToastError = jest.fn()

jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ info: mockToastInfo, error: mockToastError }),
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, className, onClick, type }: ComponentProps<'button'>) => (
        <button type={type} className={className} onClick={onClick}>
            {children}
        </button>
    ),
}))

jest.mock('@/components/Global/Icons/Icon', () => ({
    Icon: () => null,
}))

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')
const originalSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')
let consoleErrorSpy: jest.SpyInstance

function restoreProperty(target: object, key: string, descriptor?: PropertyDescriptor) {
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else delete (target as Record<string, unknown>)[key]
}

beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
})

afterEach(() => {
    consoleErrorSpy.mockRestore()
})

afterAll(() => {
    restoreProperty(navigator, 'clipboard', originalClipboard)
    restoreProperty(navigator, 'share', originalShare)
    restoreProperty(window, 'isSecureContext', originalSecureContext)
    restoreProperty(document, 'execCommand', originalExecCommand)
})

describe('ShareButton', () => {
    it('does not report success when desktop clipboard copying fails', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
        })
        const onSuccess = jest.fn()
        const onError = jest.fn()

        renderWithIntl(
            <ShareButton
                generateText={() => Promise.resolve('Badge share text')}
                onSuccess={onSuccess}
                onError={onError}
            >
                Share badge
            </ShareButton>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Share badge' }))

        await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
        expect(onSuccess).not.toHaveBeenCalled()
        expect(mockToastError).toHaveBeenCalledTimes(1)
    })

    it('does not report success when the legacy copy fallback returns false', async () => {
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: jest.fn().mockReturnValue(false),
        })
        const onSuccess = jest.fn()
        const onError = jest.fn()

        renderWithIntl(
            <ShareButton
                generateText={() => Promise.resolve('Badge share text')}
                onSuccess={onSuccess}
                onError={onError}
            >
                Share badge
            </ShareButton>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Share badge' }))

        await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
        expect(onSuccess).not.toHaveBeenCalled()
        expect(mockToastError).toHaveBeenCalledTimes(1)
        expect(document.querySelector('textarea')).toBeNull()
    })

    it('reports success after desktop clipboard copying succeeds', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
        })
        const onSuccess = jest.fn()

        renderWithIntl(
            <ShareButton generateText={() => Promise.resolve('Badge share text')} onSuccess={onSuccess}>
                Share badge
            </ShareButton>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Share badge' }))

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(mockToastInfo).toHaveBeenCalledTimes(1)
        expect(mockToastError).not.toHaveBeenCalled()
    })

    // A cancelled share sheet after a successful copy is still an outcome: the
    // content is on the clipboard and the "copied" toast already showed, so
    // consumers capturing INVITE_LINK_SHARED on onSuccess must count it.
    it('reports success when the share sheet is cancelled after the copy landed', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
        })
        const abort = new Error('cancelled')
        abort.name = 'AbortError'
        Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: jest.fn().mockRejectedValue(abort),
        })
        const onSuccess = jest.fn()
        const onError = jest.fn()

        renderWithIntl(
            <ShareButton
                generateText={() => Promise.resolve('Badge share text')}
                onSuccess={onSuccess}
                onError={onError}
            >
                Share badge
            </ShareButton>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Share badge' }))

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(onError).not.toHaveBeenCalled()
        expect(mockToastError).not.toHaveBeenCalled()
    })

    // the reservation is opened inside the click, so a failure before the text
    // exists must still settle it — WebKit holds a pending write otherwise
    it('settles the reserved clipboard write when the share url cannot be generated', async () => {
        const write = jest.fn().mockReturnValue(new Promise(() => {}))
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write, writeText: jest.fn() },
        })
        ;(globalThis as { ClipboardItem?: unknown }).ClipboardItem = class {
            constructor(public data: Record<string, Promise<Blob>>) {}
        }
        const onError = jest.fn()
        const onSuccess = jest.fn()

        renderWithIntl(
            <ShareButton
                generateUrl={() => Promise.reject(new Error('offline'))}
                onSuccess={onSuccess}
                onError={onError}
            >
                Share badge
            </ShareButton>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Share badge' }))

        await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
        expect(onSuccess).not.toHaveBeenCalled()
        expect(mockToastError).toHaveBeenCalledTimes(1)

        const item = write.mock.calls[0][0][0] as { data: Record<string, Promise<Blob>> }
        await expect(item.data['text/plain']).rejects.toThrow()

        delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem
    })

    it('stays quiet when the share sheet is cancelled and nothing was copied', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
        })
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: jest.fn().mockReturnValue(false),
        })
        const abort = new Error('cancelled')
        abort.name = 'AbortError'
        Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: jest.fn().mockRejectedValue(abort),
        })
        const onSuccess = jest.fn()
        const onError = jest.fn()

        renderWithIntl(
            <ShareButton
                generateText={() => Promise.resolve('Badge share text')}
                onSuccess={onSuccess}
                onError={onError}
            >
                Share badge
            </ShareButton>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Share badge' }))

        // cancellation is not an error — but with no copy there is no success either
        await waitFor(() => expect(navigator.share).toHaveBeenCalledTimes(1))
        expect(onSuccess).not.toHaveBeenCalled()
        expect(onError).not.toHaveBeenCalled()
    })
})
