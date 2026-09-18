import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { ClaimAccountScreen } from '../components/ClaimAccountScreen'
import { CLAIMABLE_EUR, CLAIMABLE_USD_PREVIEW } from '../__fixtures__/railPolicy'
import { DEPOSIT_RAILS } from '../rails'
import type { ClaimableCorridor, DepositRail } from '../types'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

type ClaimProps = { error?: string; isUnavailable?: boolean; rail?: DepositRail; terms?: ClaimableCorridor }

const claim = ({ rail = DEPOSIT_RAILS.SEPA_EU, ...props }: ClaimProps = {}) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <ToastProvider>
                <ClaimAccountScreen
                    rail={rail}
                    userName="Demo User"
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
        expect(screen.queryByRole('button', { name: /open .* account/i })).not.toBeInTheDocument()
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
        // the tallest the step gets: three rule lines and the state note, all
        // of which have to fit above the button rather than push it into the nav
        [
            'the payer terms',
            { rail: DEPOSIT_RAILS.ACH_US, terms: CLAIMABLE_USD_PREVIEW },
            messages.depositAccounts.claim.statePending,
        ],
    ])('puts %s above the button', (_name, props, noteText) => {
        const { rail } = props as ClaimProps
        claim(props as ClaimProps)
        const cta = screen.getByRole('button', { name: new RegExp(`Open ${rail?.currency ?? 'EUR'} account`, 'i') })
        expect(orderOf(cta, screen.getByText(noteText))).toBe('note-first')
    })
})

/**
 * The terms are the reason to open an account or not, so the step states them
 * before the tap — the same three lines, from the same resolver, as the
 * details screen states once the account exists.
 */
describe('the claim screen when the backend previewed the terms', () => {
    const ruleText = (key: keyof typeof messages.depositAccounts.rules) => messages.depositAccounts.rules[key].line

    it('states who may pay in: the holder, a business, another person', () => {
        claim({ rail: DEPOSIT_RAILS.ACH_US, terms: CLAIMABLE_USD_PREVIEW })

        expect(screen.getByText(messages.depositAccounts.details.whoCanPay)).toBeInTheDocument()
        expect(screen.getByText(ruleText('ownAccount'))).toBeInTheDocument()
        expect(screen.getByText(ruleText('businessAny'))).toBeInTheDocument()
        expect(screen.getByText(/From another person: less than .* each time/)).toBeInTheDocument()
    })

    it('drops the promise that the terms come later, now that they are on screen', () => {
        claim({ rail: DEPOSIT_RAILS.ACH_US, terms: CLAIMABLE_USD_PREVIEW })

        expect(screen.queryByText(/You will see them as soon as the account is open/)).not.toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.claim.conditionNoReference)).toBeInTheDocument()
    })

    it('says the state rule is still to come only where one exists — the dollar corridor', () => {
        claim({ rail: DEPOSIT_RAILS.ACH_US, terms: CLAIMABLE_USD_PREVIEW })

        expect(screen.getByText(messages.depositAccounts.claim.statePending)).toBeInTheDocument()
    })

    it('says nothing about a state rule on a corridor whose terms are resolved', () => {
        claim({ terms: CLAIMABLE_EUR })

        expect(screen.getByText(ruleText('businessAny'))).toBeInTheDocument()
        expect(screen.queryByText(messages.depositAccounts.claim.statePending)).not.toBeInTheDocument()
    })

    /** an API that predates the preview: the step keeps the copy it had */
    it('promises the terms with the account when none were previewed', () => {
        claim()

        expect(screen.queryByText(messages.depositAccounts.details.whoCanPay)).not.toBeInTheDocument()
        expect(screen.queryByText(messages.depositAccounts.claim.statePending)).not.toBeInTheDocument()
        expect(screen.getByText(/You will see them as soon as the account is open/)).toBeInTheDocument()
    })
})

/**
 * What the corridor costs, before the account is opened.
 *
 * One sentence for every corridor: Peanut charges nothing, and money that is
 * not already dollars arrives converted. The rate itself moves, so the line
 * links to the page that shows it rather than quoting a number.
 */
describe('the fee line on the claim screen', () => {
    it('says only "no fee" on a dollar account, which converts nothing', () => {
        claim({ rail: DEPOSIT_RAILS.ACH_US })

        expect(screen.getByText(messages.depositAccounts.fees.noFee)).toBeInTheDocument()
        expect(screen.queryByTestId('deposit-fee-rates')).not.toBeInTheDocument()
    })

    it('names the conversion and links to the euro rate', () => {
        claim({ rail: DEPOSIT_RAILS.SEPA_EU })

        expect(screen.getByText(messages.depositAccounts.fees.converted)).toBeInTheDocument()
        expect(screen.getByTestId('deposit-fee-rates')).toHaveAttribute(
            'href',
            '/profile/exchange-rate?from=USD&to=EUR'
        )
    })

    it('links each corridor to its own currency', () => {
        claim({ rail: DEPOSIT_RAILS.SPEI_MX })

        expect(screen.getByTestId('deposit-fee-rates')).toHaveAttribute(
            'href',
            '/profile/exchange-rate?from=USD&to=MXN'
        )
    })
})
