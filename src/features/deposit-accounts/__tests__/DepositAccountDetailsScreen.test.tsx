import { fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import messages from '@/i18n/app/messages/en.json'
import { NextIntlClientProvider } from 'next-intl'
import { DepositAccountDetailsScreen } from '../components/DepositAccountDetailsScreen'
import { DEPOSIT_RAIL_POLICY } from '../__fixtures__/railPolicy'
import { DEPOSIT_RAILS } from '../rails'
import type { DepositAccountView, DepositRail } from '../types'

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
 * EUR is offered to anyone, and the one third-party SEPA transfer seen so far
 * was returned by the provider as a third-party payment. Until a third-party
 * euro credit is proven, the holder reads what to ask of a payer beside the
 * terms.
 */
describe('the euro caveat on the details screen', () => {
    const active = (railId: string, currency: string): DepositAccountView => ({
        ...provisioning,
        railId,
        currency,
        status: 'active',
        instructions: { accountHolderName: 'Ana Pérez', iban: 'DE89', paymentRails: ['sepa'] },
    })

    it('tells the euro holder, under the toggle, that transfers from another name can be returned', () => {
        details(
            active('bridge.sepa_eu', 'EUR'),
            () => {},
            true,
            () => {},
            DEPOSIT_RAILS.SEPA_EU
        )
        openTerms()

        expect(screen.getByText(messages.depositAccounts.details.eurOwnName)).toBeInTheDocument()
    })

    it('says nothing of the kind on the dollar account', () => {
        details(active('bridge.ach_us', 'USD'), () => {}, true)
        openTerms()

        expect(screen.queryByText(messages.depositAccounts.details.eurOwnName)).not.toBeInTheDocument()
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
        messages.depositAccounts.rules.ownAccount.line,
        messages.depositAccounts.rules.businessAny.line,
        messages.depositAccounts.details.eurOwnName,
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
        expect(screen.queryByText(messages.depositAccounts.details.whoCanPay)).not.toBeInTheDocument()
        expect(screen.queryByText(messages.depositAccounts.details.sectionTitle)).not.toBeInTheDocument()
    })

    it('reveals who can pay, the fee and the timing when the toggle opens', () => {
        renderEur()
        openTerms()

        for (const line of secondary) expect(screen.getByText(line)).toBeInTheDocument()
        expect(screen.getByTestId('deposit-fee-rates')).toBeInTheDocument()
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
