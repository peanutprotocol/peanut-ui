import { IntlWrapper } from '@/test-utils/intl'
import { fireEvent, render, screen } from '@testing-library/react'
import { BankInstructionsToggle } from '../BankInstructionsToggle'

type TestAccount = { status: string; matching: { sender: string }; instructions?: unknown }

let accounts: Record<string, TestAccount | undefined> = {}
// The toggle asks canShare(account, gate) for the corridor the payer is handed,
// so the hook must expose per-corridor gates. Default every corridor to a ready
// gate; a test overrides one to prove a blocked corridor hides the opt-in.
let gates: Record<string, { kind: string }> = {}
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({ accounts, gates }),
}))

// canShare needs live instructions present, so the fixture carries them by default.
const account = (
    status: string,
    sender = 'anyone',
    instructions: unknown = { railId: 'bridge.sepa_eu' }
): TestAccount => ({
    status,
    matching: { sender },
    instructions,
})

const renderToggle = (checked = false, onChange = jest.fn()) => {
    render(<BankInstructionsToggle checked={checked} onChange={onChange} />, { wrapper: IntlWrapper })
    return onChange
}

beforeEach(() => {
    accounts = {}
    gates = new Proxy({}, { get: () => ({ kind: 'ready' }) }) as Record<string, { kind: string }>
})

describe('BankInstructionsToggle', () => {
    it('offers the opt-in to a user who holds an active account', () => {
        accounts = { SEPA_EU: account('active') }

        renderToggle()

        expect(screen.getByTestId('bank-instructions-toggle')).toHaveAttribute('aria-checked', 'false')
    })

    // Offering it here would promise the payer bank details that do not exist
    // yet, and the request would sit open waiting for a transfer nobody could
    // make.
    it('stays hidden while no account can receive the money', () => {
        accounts = { SEPA_EU: account('provisioning'), ACH_US: account('revoked') }

        renderToggle()

        expect(screen.queryByTestId('bank-instructions-toggle')).not.toBeInTheDocument()
    })

    it('stays hidden for a user who holds no account at all', () => {
        renderToggle()

        expect(screen.queryByTestId('bank-instructions-toggle')).not.toBeInTheDocument()
    })

    // An active account whose corridor gate is blocked cannot be paid into, so
    // offering the opt-in would hand a payer details that fail — the same test
    // the Share action runs.
    it('stays hidden when the payable account’s corridor gate is not open', () => {
        accounts = { SEPA_EU: account('active') }
        gates = { SEPA_EU: { kind: 'needs-identity' } }

        renderToggle()

        expect(screen.queryByTestId('bank-instructions-toggle')).not.toBeInTheDocument()
    })

    // No live instructions means there are no numbers to share yet.
    it('stays hidden when the payable account has no live instructions', () => {
        accounts = { SEPA_EU: { status: 'active', matching: { sender: 'anyone' } } }

        renderToggle()

        expect(screen.queryByTestId('bank-instructions-toggle')).not.toBeInTheDocument()
    })

    it('reports the opt-in when the user turns it on', () => {
        accounts = { SEPA_EU: account('active') }

        const onChange = renderToggle(false)
        fireEvent.click(screen.getByTestId('bank-instructions-toggle'))

        expect(onChange).toHaveBeenCalledWith(true)
    })

    describe('who may pay', () => {
        // The sender-line only describes a live disclosure, so it only shows
        // once the toggle is actually ON (checked=true below).
        it('says anyone may pay on a corridor that takes third-party money', () => {
            accounts = { SEPA_EU: account('active', 'anyone') }

            renderToggle(true)

            expect(screen.getByText(/They can then pay you by bank transfer\./)).toBeInTheDocument()
        })

        // A friend's transfer into a business-only corridor comes back to them.
        // The requester has to read that before they share the link, not after.
        it('warns that only businesses may pay on a business-only corridor', () => {
            accounts = { SEPA_EU: account('active', 'business-only') }

            renderToggle(true)

            expect(screen.getByText(/Only businesses can pay this by bank transfer\./)).toBeInTheDocument()
        })

        // Nothing a third party can pay into, so there is nothing to offer.
        it('does not offer the opt-in at all when only the holder may pay in', () => {
            accounts = { SEPA_EU: account('active', 'own-name-only') }

            renderToggle()

            expect(screen.queryByTestId('bank-instructions-toggle')).not.toBeInTheDocument()
        })

        // Silence from the rail is not permission, and it is not a reason to
        // say nothing either.
        it('says a third-party transfer is unconfirmed where the rail publishes nothing', () => {
            accounts = { SEPA_EU: account('active', 'unknown') }

            renderToggle(true)

            expect(screen.getByText(/is not confirmed on this account/)).toBeInTheDocument()
        })
    })

    // The payer is given ONE account, and the deposit-instructions route picks
    // the first active one in catalogue order. The line must describe that
    // account, not whichever one the record happens to list first.
    it('reads the policy of the account the payer will be given', () => {
        accounts = { ACH_US: account('active', 'business-only'), SEPA_EU: account('active', 'anyone') }

        renderToggle(true)

        expect(screen.getByText(/They can then pay you by bank transfer\./)).toBeInTheDocument()
    })

    describe('state-reactive copy', () => {
        // ON reads as a privacy disclosure: sharing the link exposes bank
        // details and a full name, not just "here's how payers pay you".
        it('shows the sharing disclosure while checked', () => {
            accounts = { SEPA_EU: account('active') }

            renderToggle(true)

            expect(screen.getByText('Share your bank details')).toBeInTheDocument()
            expect(
                screen.getByText(/Anyone who opens this link sees your bank details and full name\./)
            ).toBeInTheDocument()
        })

        // OFF says two things and stops: the details stay private, and a payer
        // can still pay with Peanut or crypto. The pay screen does list a
        // generic bank method either way — that method funds the payer's own
        // Peanut balance — but the copy deliberately does not mention it, by
        // Hugo's ruling of 2026-09-21: every payment ends up in Peanut, so
        // naming the payer's own bank only confused the requester. It drops
        // the sender line: there is no live disclosure to qualify.
        it('shows the opt-out copy while unchecked, with no sender line', () => {
            accounts = { SEPA_EU: account('active', 'business-only') }

            renderToggle(false)

            expect(screen.getByText('Your bank details stay private')).toBeInTheDocument()
            expect(screen.getByText('Payers can pay you with Peanut or crypto.')).toBeInTheDocument()
            expect(screen.queryByText(/Only businesses can pay this by bank transfer\./)).not.toBeInTheDocument()
            expect(screen.queryByText(/their own bank/)).not.toBeInTheDocument()
        })

        // A name that flips with the state reads "Don't share…, switch, off".
        it.each([true, false])('names the switch the same way when checked is %s', (checked) => {
            accounts = { SEPA_EU: account('active') }

            renderToggle(checked)

            expect(screen.getByRole('switch', { name: 'Share your bank details' })).toBeInTheDocument()
        })
    })
})
