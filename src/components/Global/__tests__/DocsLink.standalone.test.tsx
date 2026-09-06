/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import DocsLink from '@/components/Global/DocsLink'

let mockIsPWA = false
jest.mock('@/hooks/usePWAStatus', () => ({ usePWAStatus: () => mockIsPWA }))

let mockIsCapacitor = false
const mockOpenExternalUrl = jest.fn()
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor,
    openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

const renderLink = () => {
    render(<DocsLink href="/en/help/passkeys">docs</DocsLink>, { wrapper: IntlWrapper })
    return screen.getByRole('link', { name: 'docs' })
}

// A home-screen PWA that opens docs in a new tab leaves the standalone window;
// returning relaunches at start_url, which re-derives the language from the
// browser instead of the app's choice. Same-tab navigation keeps the session.
describe('DocsLink in a standalone PWA', () => {
    beforeEach(() => {
        mockIsPWA = false
        mockIsCapacitor = false
    })

    it('opens a new tab in a plain browser tab', () => {
        const link = renderLink()
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('href', '/en/help/passkeys')
    })

    it('navigates same-tab when the app runs standalone', () => {
        mockIsPWA = true
        const link = renderLink()
        expect(link).not.toHaveAttribute('target')
        expect(link).toHaveAttribute('href', '/en/help/passkeys')
    })

    it('keeps the in-app browser path on Capacitor, where usePWAStatus also reads true', () => {
        mockIsPWA = true
        mockIsCapacitor = true
        const link = renderLink()
        expect(link).toHaveAttribute('target', '_blank')
    })
})
