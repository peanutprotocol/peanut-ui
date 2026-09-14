import { fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import messages from '@/i18n/app/messages/en.json'
import { NextIntlClientProvider } from 'next-intl'
import { DepositAccountDetailsScreen } from '../components/DepositAccountDetailsScreen'
import { DEPOSIT_RAILS } from '../rails'
import type { DepositAccountView } from '../types'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const provisioning: DepositAccountView = {
    id: 'acct-usd',
    railId: 'bridge.ach_us',
    country: 'US',
    currency: 'USD',
    status: 'provisioning',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'anyone' },
}

const details = (account: DepositAccountView, onRetry = () => {}, canShare = false, onContactSupport = () => {}) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <ToastProvider>
                <DepositAccountDetailsScreen
                    rail={DEPOSIT_RAILS.ACH_US}
                    account={account}
                    userName="Ana Pérez"
                    canShare={canShare}
                    onBack={() => {}}
                    onShare={() => {}}
                    onRetry={onRetry}
                    onContactSupport={onContactSupport}
                />
            </ToastProvider>
        </NextIntlClientProvider>
    )

/**
 * The provider never answered inside the wait the app gives it. The backend
 * still says `provisioning` and never says otherwise, so the screen has to
 * read the client's own flag — and it is the one state with a retry on it.
 * Nothing else can show this screen, which is why it has a test rather than a
 * fixture: no mocked response reaches it.
 */
describe('the details screen when the provisioning wait runs out', () => {
    it('keeps the skeleton while the account is still within its budget', () => {
        details(provisioning)
        expect(screen.getByTestId('deposit-details-skeleton')).toBeInTheDocument()
    })

    it('offers a retry once the wait has timed out', () => {
        const onRetry = jest.fn()
        details({ ...provisioning, timedOut: true }, onRetry)

        expect(screen.queryByTestId('deposit-details-skeleton')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: messages.depositAccounts.details.timedOutRetry }))
        expect(onRetry).toHaveBeenCalled()
    })
})

/**
 * The footer used to ask only whether the rail's sender policy allows sharing,
 * while the resolver also wanted live details and an open corridor. A retiring
 * account therefore offered a Share button that bounced straight back here,
 * with nothing said to the user.
 */
describe('the details screen share footer', () => {
    const active: DepositAccountView = {
        ...provisioning,
        status: 'active',
        instructions: { accountHolderName: 'Ana Pérez', accountNumber: '9600', paymentRails: ['ach_push'] },
    }

    it('offers Share when the resolver would serve it', () => {
        details(active, () => {}, true)
        expect(screen.getByRole('button', { name: messages.depositAccounts.details.shareCta })).toBeInTheDocument()
    })

    it('offers no Share button when the resolver would send it back', () => {
        details({ ...active, status: 'retiring' }, () => {}, false)
        expect(
            screen.queryByRole('button', { name: messages.depositAccounts.details.shareCta })
        ).not.toBeInTheDocument()
    })
})

/**
 * Revoked details have no self-service fix. Claiming again returns the same
 * dead account — the provider's create call is idempotent per customer and
 * currency — so the screen hands the user to a person rather than to a button
 * that loops back to the same failure.
 */
describe('the details screen for revoked details', () => {
    const revoked: DepositAccountView = { ...provisioning, status: 'revoked' }

    it('offers support, which is the only way out', () => {
        const onContactSupport = jest.fn()
        details(revoked, () => {}, false, onContactSupport)

        fireEvent.click(screen.getByRole('button', { name: messages.depositAccounts.details.revokedCta }))
        expect(onContactSupport).toHaveBeenCalled()
    })

    it('still says what the dead details do to money sent to them', () => {
        details(revoked)

        expect(screen.getByText(messages.depositAccounts.details.revokedBody)).toBeInTheDocument()
    })
})
