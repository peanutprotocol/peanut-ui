import { IntlWrapper } from '@/test-utils/intl'
import { fireEvent, render, screen } from '@testing-library/react'
import { BankInstructionsToggle } from '../BankInstructionsToggle'

type TestAccount = { status: string; matching: { sender: string } }

let accounts: Record<string, TestAccount | undefined> = {}
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({ accounts }),
}))

const account = (status: string, sender = 'anyone'): TestAccount => ({ status, matching: { sender } })

const renderToggle = (checked = false, onChange = jest.fn()) => {
    render(<BankInstructionsToggle checked={checked} onChange={onChange} />, { wrapper: IntlWrapper })
    return onChange
}

beforeEach(() => {
    accounts = {}
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

    it('reports the opt-in when the user turns it on', () => {
        accounts = { SEPA_EU: account('active') }

        const onChange = renderToggle(false)
        fireEvent.click(screen.getByTestId('bank-instructions-toggle'))

        expect(onChange).toHaveBeenCalledWith(true)
    })

    describe('who may pay', () => {
        it('says anyone may pay on a corridor that takes third-party money', () => {
            accounts = { SEPA_EU: account('active', 'anyone') }

            renderToggle()

            expect(screen.getByText(/Anyone can pay this by bank transfer\./)).toBeInTheDocument()
        })

        // A friend's transfer into a business-only corridor comes back to them.
        // The requester has to read that before they share the link, not after.
        it('warns that only businesses may pay on a business-only corridor', () => {
            accounts = { SEPA_EU: account('active', 'business-only') }

            renderToggle()

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

            renderToggle()

            expect(screen.getByText(/is not confirmed on this account/)).toBeInTheDocument()
        })
    })

    // The payer is given ONE account, and the deposit-instructions route picks
    // the first active one in catalogue order. The line must describe that
    // account, not whichever one the record happens to list first.
    it('reads the policy of the account the payer will be given', () => {
        accounts = { ACH_US: account('active', 'business-only'), SEPA_EU: account('active', 'anyone') }

        renderToggle()

        expect(screen.getByText(/Anyone can pay this by bank transfer\./)).toBeInTheDocument()
    })
})
