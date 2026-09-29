import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import messages from '@/i18n/app/messages/en.json'
import { NextIntlClientProvider } from 'next-intl'
import { DepositAccountDetailsScreen } from '../components/DepositAccountDetailsScreen'
import { DEPOSIT_RAIL_POLICY } from '../__fixtures__/railPolicy'
import { DEPOSIT_RAILS } from '../rails'
import type { DepositAccountView, DepositRail } from '../types'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
const mockCopy = jest.fn(async (_text: string) => true)
jest.mock('@/utils/clipboard.utils', () => ({ copyTextToClipboard: (text: string) => mockCopy(text) }))

const provisioning: DepositAccountView = {
    id: 'acct-usd',
    railId: 'bridge.ach_us',
    country: 'US',
    currency: 'USD',
    status: 'provisioning',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'anyone' },
}

const details = (
    account: DepositAccountView,
    onRetry = () => {},
    canShare = false,
    onContactSupport = () => {},
    rail: DepositRail = DEPOSIT_RAILS.ACH_US
) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <ToastProvider>
                <DepositAccountDetailsScreen
                    rail={rail}
                    account={account}
                    userName="Ana Pérez"
                    canShare={canShare}
                    onBack={() => {}}
                    onRetry={onRetry}
                    onContactSupport={onContactSupport}
                />
            </ToastProvider>
        </NextIntlClientProvider>
    )

const openTerms = () =>
    fireEvent.click(screen.getByRole('button', { name: messages.depositAccounts.details.termsToggle }))

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

    // The pulse is decorative: it stops when the user asks for reduced motion
    // (sep-23 review, A34).
    it('stops every skeleton pulse under reduced motion', () => {
        details(provisioning)
        const pulses = screen.getByTestId('deposit-details-skeleton').querySelectorAll('.animate-pulse')
        expect(pulses.length).toBeGreaterThan(0)
        pulses.forEach((el) => expect(el).toHaveClass('motion-reduce:animate-none'))
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

/**
 * The Colombian account is credited by key AND reference. The API returns the
 * reference as `depositMessage`; it was never rendered, copied or shared, so a
 * payer following the screen sent money that never arrived.
 */
describe('the details screen on an account with a reference', () => {
    const cop: DepositAccountView = {
        ...provisioning,
        id: 'acct-cop',
        railId: 'bridge.bank_transfer_co',
        country: 'CO',
        currency: 'COP',
        status: 'active',
        matching: { nameOnAccount: 'user', sender: 'business-only' },
        instructions: {
            accountHolderName: 'Ana Pérez',
            breBKey: '@DEMO123',
            depositMessage: 'PEANUT-7F3A',
            paymentRails: ['bre_b'],
        },
    }

    it('renders the reference as a row of its own and says it is required', () => {
        details(
            cop,
            () => {},
            true,
            () => {},
            DEPOSIT_RAILS.BANK_TRANSFER_CO
        )

        expect(screen.getByText(messages.depositAccounts.rows.reference)).toBeInTheDocument()
        expect(screen.getByText('PEANUT-7F3A')).toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.details.referenceRequired)).toBeInTheDocument()
    })

    it('says nothing about a reference on an account without one', () => {
        details({ ...provisioning, status: 'active', instructions: { accountHolderName: 'Ana', paymentRails: [] } })

        expect(screen.queryByText(messages.depositAccounts.rows.reference)).not.toBeInTheDocument()
        expect(screen.queryByText(messages.depositAccounts.details.referenceRequired)).not.toBeInTheDocument()
    })
})

/**
 * The founders review (2026-09-23) called this the heaviest screen in the app.
 * Closed, it carries what a bank's own account-details screen carries: a
 * title, one card of numbers, and the actions that hand them over. Who can
 * pay, fees and timing sit behind one toggle.
 */
describe('the details screen, collapsed and open', () => {
    const eur: DepositAccountView = {
        ...provisioning,
        id: 'acct-eur',
        railId: 'bridge.sepa_eu',
        currency: 'EUR',
        status: 'active',
        rules: DEPOSIT_RAIL_POLICY.SEPA_EU.rules,
        instructions: {
            accountHolderName: 'Ana Pérez',
            iban: 'DE89 3704 0044 0532 0130 00',
            bic: 'MTBEBEBB',
            paymentRails: ['sepa'],
        },
    }
    const secondary = [
        messages.depositAccounts.rules.ownOrBusinessAny.line,
        // a round amount without cents, and no closing period (QA 2026-09-24)
        'Other people: Under €4,000 per transfer',
        messages.depositAccounts.rules.individualCapFamily.line,
        'Minimum: €1',
        messages.depositAccounts.fees.converted,
        messages.depositAccounts.corridors.SEPA_EU.arrivalDetail,
    ]
    const renderEur = () =>
        details(
            eur,
            () => {},
            true,
            () => {},
            DEPOSIT_RAILS.SEPA_EU
        )

    it('shows only the title, the card, the toggle and the actions while closed', () => {
        renderEur()

        expect(screen.getByText('DE89 3704 0044 0532 0130 00')).toBeInTheDocument()
        expect(screen.getByText(messages.depositAccounts.rows.iban)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: messages.depositAccounts.details.termsToggle })).toHaveAttribute(
            'aria-expanded',
            'false'
        )
        expect(screen.getByRole('button', { name: messages.depositAccounts.details.shareCta })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: messages.depositAccounts.share.copyCta })).toBeInTheDocument()
        for (const line of secondary) expect(screen.queryByText(line)).not.toBeInTheDocument()
        expect(screen.queryByText(messages.depositAccounts.claim.whoCanPay)).not.toBeInTheDocument()
        // "Bank details" is the screen title only; no section header repeats it over the card
        expect(messages.depositAccounts.title).toBe(messages.depositAccounts.details.sectionTitle)
        expect(screen.getAllByText(messages.depositAccounts.details.sectionTitle)).toHaveLength(1)
        // the heading already names the rail
        expect(screen.queryByText(messages.depositAccounts.rows.accepts)).not.toBeInTheDocument()
    })

    // The shared copy control confirms on itself; a copy that worked is not a
    // toast (sep-23 review, A35).
    it('confirms "Copy all" on the button itself, with no toast', async () => {
        renderEur()

        fireEvent.click(screen.getByRole('button', { name: messages.depositAccounts.share.copyCta }))

        await waitFor(() =>
            expect(screen.getByRole('button', { name: messages.global.copyField.copied })).toBeInTheDocument()
        )
        expect(mockCopy).toHaveBeenCalledWith(expect.stringContaining('DE89 3704 0044 0532 0130 00'))
        expect(screen.queryByText('Details copied')).not.toBeInTheDocument()
    })

    /*
     * QA 2026-09-24: each rule is stated once per screen. A business-only
     * account used to repeat its rule in a sentence above the toggle.
     */
    it('states a business-only rule once, inside the toggle', () => {
        details(
            {
                ...eur,
                railId: 'bridge.faster_payments_gb',
                currency: 'GBP',
                matching: { nameOnAccount: 'provider', sender: 'business-only' },
                rules: DEPOSIT_RAIL_POLICY.FASTER_PAYMENTS_GB.rules,
                instructions: {
                    accountHolderName: 'Pooled Ltd',
                    sortCode: '040000',
                    accountNumber: '12345678',
                    paymentRails: ['faster_payments'],
                },
            },
            () => {},
            true,
            () => {},
            DEPOSIT_RAILS.FASTER_PAYMENTS_GB
        )

        expect(screen.queryByText(messages.depositAccounts.rules.individualNotYet.line)).not.toBeInTheDocument()
        openTerms()
        expect(screen.getAllByText(messages.depositAccounts.rules.individualNotYet.line)).toHaveLength(1)
        expect(screen.getAllByText(messages.depositAccounts.rules.ownOrBusinessAny.line)).toHaveLength(1)
        expect(screen.getByText('Minimum: £2')).toBeInTheDocument()
    })

    it('reveals who can pay, the fee and the timing when the toggle opens', () => {
        renderEur()
        openTerms()

        for (const line of secondary) expect(screen.getByText(line)).toBeInTheDocument()
        expect(screen.getByTestId('deposit-fee-rates')).toBeInTheDocument()
        // an inline link: no expanded hit area reaching into the lines around it (A27)
        expect(screen.getByTestId('deposit-fee-rates').className).not.toMatch(/after:/)
    })

    it('keeps an own-name-only rule beside the card, where it decides who can use the account', () => {
        details(
            {
                ...eur,
                railId: 'manteca.pix_br',
                currency: 'BRL',
                matching: { nameOnAccount: 'user', sender: 'own-name-only' },
                rules: undefined,
            },
            () => {},
            false,
            () => {},
            DEPOSIT_RAILS.PIX_BR
        )

        expect(screen.getByText(messages.depositAccounts.rules.ownName.line)).toBeInTheDocument()
        openTerms()
        expect(screen.getAllByText(messages.depositAccounts.rules.ownName.line)).toHaveLength(1)
    })
})

/**
 * The card no longer carries an "Accepts" row, so the heading has to state the
 * rails of THIS account. A static "ACH or wire" over an ACH-only account would
 * send its holder asking a payer for a wire that never arrives.
 */
describe('the details heading names the rails the account takes', () => {
    const usd = (paymentRails: string[]): DepositAccountView => ({
        ...provisioning,
        status: 'active',
        instructions: { accountHolderName: 'Ana Pérez', accountNumber: '9600', routingNumber: '0210', paymentRails },
    })

    it('says ACH alone on an ACH-only dollar account, and no wire anywhere', () => {
        details(usd(['ach_push']), () => {}, true)

        expect(screen.getByText('USD · ACH')).toBeInTheDocument()
        expect(screen.queryByText(/wire/i)).not.toBeInTheDocument()
        expect(screen.queryByText(messages.depositAccounts.rows.accepts)).not.toBeInTheDocument()
    })

    it('names both rails when the account takes both', () => {
        details(usd(['ach_push', 'wire']), () => {}, true)

        expect(screen.getByText('USD · ACH or Wire')).toBeInTheDocument()
    })

    it('falls back to the corridor name while the details are being set up', () => {
        details(provisioning)

        expect(screen.getByText(`USD · ${messages.depositAccounts.corridors.ACH_US.railName}`)).toBeInTheDocument()
    })
})
