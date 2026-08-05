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
})
