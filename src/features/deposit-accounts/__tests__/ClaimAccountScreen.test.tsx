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

/**
 * The CTA has to END the page. The app shell reserves 6rem below the scroller
 * to clear the fixed bottom nav, and that reservation clears whatever the last
 * element is. With a Notification after the button the reservation cleared the
 * Notification, and at 375x667 the button first painted 49px inside the band
 * the nav owns — visible, and a tap on it changed tabs.
 */
describe('the CTA ends the page, so the shell reservation clears it', () => {
    const orderOf = (cta: HTMLElement, note: HTMLElement) =>
        cta.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_PRECEDING ? 'note-first' : 'cta-first'

    it.each([
        ['the conditions', {}, messages.depositAccounts.claim.conditionNoReference],
        ['a failure', { error: 'Could not open the account' }, 'Could not open the account'],
        ['the rollout refusal', { error: 'nope', isUnavailable: true }, messages.depositAccounts.gate.notYetBody],
    ])('puts %s above the button', (_name, props, noteText) => {
        claim(props as { error?: string; isUnavailable?: boolean })
        const cta = screen.getByRole('button', { name: /Open EUR account/i })
        expect(orderOf(cta, screen.getByText(noteText))).toBe('note-first')
    })
})
