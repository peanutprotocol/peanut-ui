/** @jest-environment jsdom */
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { LoginRecoveryDrawer } from '../LoginRecoveryDrawer'

const steps = () =>
    within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((item) => item.textContent)

describe('LoginRecoveryDrawer', () => {
    it.each([
        ['ios', 'Apple Account', 'Or log in on that phone.'],
        ['android', 'Google account', 'Or log in on that phone.'],
        ['web', 'Log in on the phone where you created Peanut.', 'Apple or Google account in this browser'],
    ] as const)('lists the way back in on %s', (platform, first, second) => {
        renderWithIntl(
            <LoginRecoveryDrawer
                visible
                onClose={jest.fn()}
                onRetry={jest.fn()}
                onSignUp={jest.fn()}
                platform={platform}
            />
        )

        expect(screen.getByText('Your passkey may be on another phone')).toBeInTheDocument()
        expect(screen.getByText(/passkey saved when you created your account/)).toBeInTheDocument()
        const [stepOne, stepTwo] = steps()
        expect(steps()).toHaveLength(2)
        expect(stepOne).toContain(first)
        expect(stepTwo).toContain(second)
    })

    it('retries and signs up from its own buttons, and links to support', () => {
        const onRetry = jest.fn()
        const onSignUp = jest.fn()
        renderWithIntl(
            <LoginRecoveryDrawer visible onClose={jest.fn()} onRetry={onRetry} onSignUp={onSignUp} platform="ios" />
        )

        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        fireEvent.click(screen.getByRole('button', { name: 'I’m new, create an account' }))
        expect(onRetry).toHaveBeenCalledTimes(1)
        expect(onSignUp).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('link', { name: 'Still stuck?' })).toHaveAttribute('href', 'https://peanut.me/support')
    })

    it('omits sign-up where the surface does not offer it', () => {
        renderWithIntl(<LoginRecoveryDrawer visible onClose={jest.fn()} onRetry={jest.fn()} platform="web" />)

        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /create an account/i })).not.toBeInTheDocument()
    })
})
