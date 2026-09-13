import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { ClaimAccountScreen } from '../components/ClaimAccountScreen'
import { DEPOSIT_RAILS } from '../rails'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const claim = (props: { error?: string; isUnavailable?: boolean } = {}) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <ToastProvider>
                <ClaimAccountScreen
                    rail={DEPOSIT_RAILS.SEPA_EU}
                    isClaiming={false}
                    onClaim={() => {}}
                    onBack={() => {}}
                    {...props}
                />
            </ToastProvider>
        </NextIntlClientProvider>
    )

/**
 * The claim route carries a server-side rollout gate that refuses users
 * outside the rollout whatever the client-side flag says. That refusal is not
 * a failure the user can retry their way out of, and the backend's own
 * sentence is written for us, not for them.
 */
describe('the claim screen when the backend refuses to open an account', () => {
    it('says the feature is not open to them yet, in our own words', () => {
        claim({ error: 'deposit accounts are not enabled', isUnavailable: true })

        expect(screen.getByText(messages.depositAccounts.gate.notYetTitle)).toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.gate.notYetBody)).toBeInTheDocument()
        expect(screen.queryByText('deposit accounts are not enabled')).not.toBeInTheDocument()
    })

    it('still shows an ordinary failure, which is worth retrying', () => {
        claim({ error: 'Could not open the account' })

        expect(screen.getByText(messages.depositAccounts.claim.errorTitle)).toBeInTheDocument()
        expect(screen.getByText('Could not open the account')).toBeInTheDocument()
        expect(screen.queryByText(messages.depositAccounts.gate.notYetTitle)).not.toBeInTheDocument()
    })

    it('keeps the conditions on screen when nothing has failed', () => {
        claim()

        expect(screen.queryByText(messages.depositAccounts.gate.notYetTitle)).not.toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.claim.conditionNoReference)).toBeInTheDocument()
    })
})
