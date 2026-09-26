import { IntlWrapper } from '@/test-utils/intl'
import { fireEvent, render, screen } from '@testing-library/react'
import { BankInstructionsToggle } from '../BankInstructionsToggle'

type TestAccount = { status: string; matching: { sender: string }; instructions?: unknown }

let accounts: Record<string, TestAccount | undefined> = {}
// The toggle asks canShare(account, gate) for the corridor the payer is handed,
// so the hook must expose per-corridor gates. Default every corridor to a ready
// gate; a test overrides one to prove a blocked corridor hides the opt-in.
let gates: Record<string, { kind: string }> = {}
let isLoading = false
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({ accounts, gates, isLoading }),
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
    isLoading = false
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

    // A row that appears after the accounts load pushes Create down under the
    // user's thumb. The placeholder holds its place (sep-23 review, A39).
    it('holds the row in place while the accounts load, with a still pulse under reduced motion', () => {
        isLoading = true

        renderToggle()

        const skeleton = screen.getByTestId('bank-instructions-toggle-skeleton')
        expect(screen.queryByTestId('bank-instructions-toggle')).not.toBeInTheDocument()
        const pulses = skeleton.querySelectorAll('.animate-pulse')
        expect(pulses.length).toBeGreaterThan(0)
        pulses.forEach((el) => expect(el).toHaveClass('motion-reduce:animate-none'))
    })

    // The row owns its body type and wrapping; the toggle hands it a plain
    // string (A40).
    it('lets the row own the disclosure line, at the row body size', () => {
        accounts = { SEPA_EU: account('active') }

        renderToggle(true)

        const line = screen.getByText('Payers see your full name and bank details.')
        expect(line).toHaveClass('text-body-s', 'whitespace-normal')
        expect(line).not.toHaveClass('text-body-xs')
    })

    it('reports the opt-in when the user turns it on', () => {
        accounts = { SEPA_EU: account('active') }

        const onChange = renderToggle(false)
        fireEvent.click(screen.getByTestId('bank-instructions-toggle'))

        expect(onChange).toHaveBeenCalledWith(true)
    })

    describe('who may pay', () => {
        // The sender warning only describes a live disclosure, so it only
        // shows once the toggle is actually ON (checked=true below). A
        // corridor anybody can pay into adds no warning.
        it('adds no warning on a corridor that takes third-party money', () => {
            accounts = { SEPA_EU: account('active', 'anyone') }

            renderToggle(true)

            expect(screen.getByText('Accept bank transfer')).toBeInTheDocument()
            expect(screen.queryByText(/Only businesses/)).not.toBeInTheDocument()
            expect(screen.queryByText(/Transfers from other people are not confirmed/)).not.toBeInTheDocument()
        })

        // A friend's transfer into a business-only corridor comes back to them.
        // The requester has to read that before they share the link, not after.
        it('warns that only businesses may pay on a business-only corridor', () => {
            accounts = { SEPA_EU: account('active', 'business-only') }

            renderToggle(true)

            expect(screen.getByText(/Only you or a business can pay in\./)).toBeInTheDocument()
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

            expect(screen.getByText(/Transfers from other people are not confirmed/)).toBeInTheDocument()
        })
    })

    // The payer is given ONE account, and the deposit-instructions route picks
    // the first active one in catalogue order. The line must describe that
    // account, not whichever one the record happens to list first.
    it('reads the policy of the account the payer will be given', () => {
        accounts = { ACH_US: account('active', 'anyone'), SEPA_EU: account('active', 'business-only') }

        renderToggle(true)

        expect(screen.getByText(/Only you or a business can pay in\./)).toBeInTheDocument()
    })

    describe('one title, and one line about what a payer sees', () => {
        // Konrad, 2026-09-23: the title says what switching it on does, so it
        // reads the same in both positions. While on, one line says the
        // payer sees the full name: the only notice that the name leaves.
        it('says a payer sees the full name and bank details while on', () => {
            accounts = { SEPA_EU: account('active', 'anyone') }

            renderToggle(true)

            expect(screen.getByText('Accept bank transfer')).toBeInTheDocument()
            expect(screen.getByText('Payers see your full name and bank details.')).toBeInTheDocument()
        })

        it('keeps the title and drops the line while off', () => {
            accounts = { SEPA_EU: account('active', 'anyone') }

            renderToggle(false)

            expect(screen.getByText('Accept bank transfer')).toBeInTheDocument()
            expect(screen.queryByText(/Payers see your full name/)).not.toBeInTheDocument()
        })

        it('puts the corridor warning after the disclosure on the same line', () => {
            accounts = { SEPA_EU: account('active', 'business-only') }

            renderToggle(true)

            expect(
                screen.getByText(/^Payers see your full name and bank details\. Only you or a business can pay in/)
            ).toBeInTheDocument()
        })

        it('drops the sender line while unchecked', () => {
            accounts = { SEPA_EU: account('active', 'business-only') }

            renderToggle(false)

            expect(screen.queryByText(/Only you or a business can pay in\./)).not.toBeInTheDocument()
        })

        // A name that flips with the state reads "Don't share…, switch, off".
        it.each([true, false])('names the switch the same way when checked is %s', (checked) => {
            accounts = { SEPA_EU: account('active') }

            renderToggle(checked)

            expect(screen.getByRole('switch', { name: 'Accept bank transfer' })).toBeInTheDocument()
        })
    })
})
