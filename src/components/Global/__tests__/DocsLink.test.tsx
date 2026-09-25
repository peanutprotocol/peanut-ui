/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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

let mockOpenHelp: jest.Mock | null = null
jest.mock('@/components/Global/AppHelpProvider', () => ({ useAppHelpDrawer: () => mockOpenHelp }))

const renderLink = () => {
    render(<DocsLink href="/en/help/passkeys">docs</DocsLink>, { wrapper: IntlWrapper })
    return screen.getByRole('link', { name: 'docs' })
}

describe('DocsLink', () => {
    beforeEach(() => {
        mockIsPWA = false
        mockIsCapacitor = false
        mockOpenHelp = null
        mockOpenExternalUrl.mockClear()
    })

    it('opens a new tab in a browser', () => {
        const link = renderLink()
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('href', '/en/help/passkeys')
    })

    it('navigates in the same tab for an installed PWA', () => {
        mockIsPWA = true
        const link = renderLink()
        expect(link).not.toHaveAttribute('target')
        expect(link).toHaveAttribute('href', '/en/help/passkeys')
    })

    it('opens the production URL in the native in-app browser', () => {
        mockIsCapacitor = true
        const link = renderLink()
        fireEvent.click(link)
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(expect.stringMatching(/\/en\/help\/passkeys$/))
    })

    describe('in-app help article', () => {
        const renderRow = () =>
            render(
                <DocsLink href="/en/help/security-disclosure" className="block">
                    row
                </DocsLink>,
                { wrapper: IntlWrapper }
            ).container.firstElementChild as HTMLElement

        // TASK-23054: a <button> sizes to its content where an <a> stretches, so
        // the drawer branch cut the About policy card short at the last row.
        it('renders the same element and classes as the link branch', () => {
            const linkRow = renderRow()
            mockOpenHelp = jest.fn()
            const drawerRow = renderRow()
            expect(drawerRow.tagName).toBe(linkRow.tagName)
            expect(drawerRow.className.split(' ')).toEqual(expect.arrayContaining(linkRow.className.split(' ')))
        })

        // no href: the native link interceptor would open the web page instead
        it('opens the drawer on tap and keyboard, with no href', () => {
            mockOpenHelp = jest.fn()
            render(<DocsLink href="/en/help/security-disclosure">docs</DocsLink>, { wrapper: IntlWrapper })
            const trigger = screen.getByRole('button', { name: 'docs' })
            expect(trigger).not.toHaveAttribute('href')
            fireEvent.click(trigger)
            fireEvent.keyDown(trigger, { key: 'Enter' })
            fireEvent.keyDown(trigger, { key: ' ' })
            expect(mockOpenHelp).toHaveBeenCalledTimes(3)
            expect(mockOpenHelp).toHaveBeenCalledWith('security-disclosure')
        })
    })
})
