import { IntlWrapper } from '@/test-utils/intl'
import { fireEvent, render, screen } from '@testing-library/react'
import { BankInstructionsToggle } from '../BankInstructionsToggle'

let accounts: Record<string, { status: string } | undefined> = {}
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({ accounts }),
}))

const renderToggle = (checked = false, onChange = jest.fn()) => {
    render(<BankInstructionsToggle checked={checked} onChange={onChange} />, { wrapper: IntlWrapper })
    return onChange
}

beforeEach(() => {
    accounts = {}
})

describe('BankInstructionsToggle', () => {
    it('offers the opt-in to a user who holds an active account', () => {
        accounts = { SEPA_EU: { status: 'active' } }

        renderToggle()

        expect(screen.getByTestId('bank-instructions-toggle')).toHaveAttribute('aria-checked', 'false')
    })

    // Offering it here would promise the payer bank details that do not exist
    // yet, and the request would sit open waiting for a transfer nobody could
    // make.
    it('stays hidden while no account can receive the money', () => {
        accounts = { SEPA_EU: { status: 'provisioning' }, ACH_US: { status: 'revoked' } }

        renderToggle()

        expect(screen.queryByTestId('bank-instructions-toggle')).not.toBeInTheDocument()
    })

    it('stays hidden for a user who holds no account at all', () => {
        renderToggle()

        expect(screen.queryByTestId('bank-instructions-toggle')).not.toBeInTheDocument()
    })

    it('reports the opt-in when the user turns it on', () => {
        accounts = { SEPA_EU: { status: 'active' } }

        const onChange = renderToggle(false)
        fireEvent.click(screen.getByTestId('bank-instructions-toggle'))

        expect(onChange).toHaveBeenCalledWith(true)
    })
})
