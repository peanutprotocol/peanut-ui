/** @jest-environment jsdom */
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { PasskeyProviderUnsupportedDrawer } from '../PasskeyProviderUnsupportedDrawer'

const renderDrawer = (props: Partial<Parameters<typeof PasskeyProviderUnsupportedDrawer>[0]> = {}) =>
    renderWithIntl(
        <PasskeyProviderUnsupportedDrawer
            visible
            platform="android-app"
            onClose={jest.fn()}
            onRetry={jest.fn()}
            onSignUpInBrowser={jest.fn()}
            {...props}
        />
    )

describe('PasskeyProviderUnsupportedDrawer', () => {
    it('names the problem and the settings path to Google Password Manager', () => {
        renderDrawer()

        expect(screen.getByText('This password manager saved a passkey Peanut can’t verify')).toBeInTheDocument()
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

    it('says the browser did not open, and keeps every way out', () => {
        renderDrawer({ browserOpenFailed: true })

        expect(screen.getByText('The browser didn’t open. Try again.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Sign up at peanut.me in a browser' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Still stuck?' })).toBeInTheDocument()
    })

    it('outside the Android app, names another password manager and offers no browser signup or Android steps', () => {
        renderDrawer({ platform: 'other' })

        expect(screen.getByText('This password manager saved a passkey Peanut can’t verify')).toBeInTheDocument()
        expect(screen.getByText('Use another password manager, then retry.')).toBeInTheDocument()
        expect(screen.queryByRole('list')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Sign up at peanut.me in a browser' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
})
