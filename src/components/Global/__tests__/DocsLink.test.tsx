/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import DocsLink from '@/components/Global/DocsLink'

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

describe('DocsLink', () => {
    beforeEach(() => {
        mockIsCapacitor = false
        mockOpenExternalUrl.mockClear()
    })

    it('opens a new tab in a browser', () => {
        const link = renderLink()
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('href', '/en/help/passkeys')
    })

    it('opens the production URL in the native in-app browser', () => {
        mockIsCapacitor = true
        const link = renderLink()
        fireEvent.click(link)
        expect(mockOpenExternalUrl).toHaveBeenCalledWith(expect.stringMatching(/\/en\/help\/passkeys$/))
    })
})
