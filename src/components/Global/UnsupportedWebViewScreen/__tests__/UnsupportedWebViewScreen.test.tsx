/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { UnsupportedWebViewScreen } from '../index'

const mockGetPlatform = jest.fn()
const mockOpenExternalUrl = jest.fn(() => Promise.resolve())
jest.mock('@/utils/capacitor', () => ({
    getPlatform: () => mockGetPlatform(),
    openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...(args as [])),
}))

const mockCaptureMessage = jest.fn()
jest.mock('@/utils/sentry-lazy', () => ({
    captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}))

describe('UnsupportedWebViewScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // First in the file on purpose: the once-only latch is module state.
    it('reports the population to Sentry once, tagged, with the user agent', () => {
        mockGetPlatform.mockReturnValue('ios-native')
        const first = renderWithIntl(<UnsupportedWebViewScreen />)
        first.unmount()
        renderWithIntl(<UnsupportedWebViewScreen />)
        expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
        expect(mockCaptureMessage).toHaveBeenCalledWith(
            expect.stringContaining('unsupported webview'),
            expect.objectContaining({
                level: 'warning',
                tags: { unsupported_webview: 'true' },
                extra: { userAgent: navigator.userAgent },
            })
        )
    })

    it('sends android to the System WebView listing on Google Play', () => {
        mockGetPlatform.mockReturnValue('android-native')
        renderWithIntl(<UnsupportedWebViewScreen />)
        expect(screen.getByRole('heading', { level: 1, name: 'Update needed to keep going' })).toBeInTheDocument()
        expect(screen.getByText(/needs a newer Android System WebView/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Update Android System WebView' }))
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(
            'https://play.google.com/store/apps/details?id=com.google.android.webview'
        )
    })

    it('sends ios to the software-update help page', () => {
        mockGetPlatform.mockReturnValue('ios-native')
        renderWithIntl(<UnsupportedWebViewScreen />)
        expect(screen.getByText(/newer version of iOS/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'See how to update iOS' }))
        expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://support.apple.com/HT204204')
    })

    it('uses inline styles only — no class names to resolve', () => {
        mockGetPlatform.mockReturnValue('android-native')
        const { container } = renderWithIntl(<UnsupportedWebViewScreen />)
        expect(container.querySelectorAll('[class]')).toHaveLength(0)
        expect(screen.getByRole('main')).toHaveStyle({ display: 'flex' })
    })
})
