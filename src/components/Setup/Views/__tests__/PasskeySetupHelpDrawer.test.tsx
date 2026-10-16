/** @jest-environment jsdom */
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { PASSKEY_NOT_SAVED_HELP } from '@/utils/webauthn.utils'
import { PasskeySetupHelpDrawer } from '../PasskeySetupHelpDrawer'

describe('PasskeySetupHelpDrawer — passkey not saved on iOS', () => {
    it('walks through iCloud Passwords in Settings order and retries from the drawer', () => {
        const onRetry = jest.fn()
        renderWithIntl(
            <PasskeySetupHelpDrawer
                visible
                onClose={jest.fn()}
                onRetry={onRetry}
                errorName={PASSKEY_NOT_SAVED_HELP}
                platform="ios"
            />
        )

        expect(screen.getByText('Your passkey wasn’t saved')).toBeInTheDocument()
        expect(screen.getByText(/keeps passkeys in iCloud Passwords/)).toBeInTheDocument()
        const steps = within(screen.getByRole('list'))
            .getAllByRole('listitem')
            .map((item) => item.textContent)
        expect(steps).toEqual([
            expect.stringContaining('tap your name at the top'),
            expect.stringContaining('turn on Sync this iPhone'),
            expect.stringContaining('Face ID & Passcode'),
            expect.stringContaining('1Password'),
        ])

        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})
