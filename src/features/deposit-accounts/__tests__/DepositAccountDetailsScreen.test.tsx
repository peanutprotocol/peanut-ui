import { fireEvent, render, screen } from '@testing-library/react'
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

const details = (account: DepositAccountView, onRetry = () => {}) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <DepositAccountDetailsScreen
                rail={DEPOSIT_RAILS.ACH_US}
                account={account}
                userName="Ana Pérez"
                onBack={() => {}}
                onShare={() => {}}
                onRetry={onRetry}
            />
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
