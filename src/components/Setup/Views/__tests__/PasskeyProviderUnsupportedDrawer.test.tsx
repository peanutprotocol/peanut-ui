/** @jest-environment jsdom */
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { PasskeyProviderUnsupportedDrawer } from '../PasskeyProviderUnsupportedDrawer'

const renderDrawer = (props: Partial<Parameters<typeof PasskeyProviderUnsupportedDrawer>[0]> = {}) =>
    renderWithIntl(
        <PasskeyProviderUnsupportedDrawer
            visible
            onClose={jest.fn()}
            onRetry={jest.fn()}
            onSignUpInBrowser={jest.fn()}
            {...props}
        />
    )

describe('PasskeyProviderUnsupportedDrawer', () => {
    it('names the problem and the settings path to Google Password Manager', () => {
        renderDrawer()

        expect(screen.getByText('This phone saved the passkey in a format Peanut can’t verify')).toBeInTheDocument()
        const steps = within(screen.getByRole('list'))
            .getAllByRole('listitem')
            .map((item) => item.textContent)
        expect(steps).toHaveLength(2)
        expect(steps[0]).toContain('Passwords, passkeys and accounts')
        expect(steps[1]).toContain('Google Password Manager')
    })

    it('retries, opens web signup and links to support from its own controls', () => {
        const onRetry = jest.fn()
        const onSignUpInBrowser = jest.fn()
        const onSupport = jest.fn()
        renderDrawer({ onRetry, onSignUpInBrowser, onSupport })

        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Sign up at peanut.me in a browser' }))
        fireEvent.click(screen.getByRole('link', { name: 'Still stuck?' }))

        expect(onRetry).toHaveBeenCalledTimes(1)
        expect(onSignUpInBrowser).toHaveBeenCalledTimes(1)
        expect(onSupport).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('link', { name: 'Still stuck?' })).toHaveAttribute('href', 'https://peanut.me/support')
    })
})
