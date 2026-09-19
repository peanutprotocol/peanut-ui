import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { WithdrawBankReviewView } from '../WithdrawBankReviewView'
import { bankReferenceProblem, bankReferenceSpecForRail } from '../../bank-reference'
import { AccountType, type Account } from '@/interfaces/interfaces'

jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ExchangeRate', () => ({ __esModule: true, default: () => null }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { fullName: 'Anna Rossi' } } }) }))

const ibanAccount = {
    id: 'acct-1',
    type: AccountType.IBAN,
    identifier: 'de89370400440532013000',
    bic: 'COBADEFFXXX',
    details: { countryCode: 'DEU', accountOwnerName: 'Anna Rossi' },
} as unknown as Account

/** The view is dumb: the harness holds the reference the way the flow hook does. */
const Harness = ({ rail, submittedTxHash = null }: { rail: string; submittedTxHash?: string | null }) => {
    const [reference, setReference] = React.useState('')
    const spec = bankReferenceSpecForRail(rail)
    return (
        <WithdrawBankReviewView
            bankAccount={ibanAccount}
            amount="50"
            country="germany"
            fromSendFlow={false}
            isLoading={false}
            isSubmitReady
            submittedTxHash={submittedTxHash}
            error={{ showError: false, errorMessage: '' }}
            balanceErrorMessage={null}
            confirmPendingCopy="processing"
            referenceSpec={spec}
            reference={reference}
            referenceProblem={spec ? bankReferenceProblem(reference, spec) : null}
            onReferenceChange={setReference}
            onSubmit={jest.fn()}
            onDone={jest.fn()}
        />
    )
}

const referenceInput = () => screen.queryByLabelText('Reference (optional)') as HTMLInputElement | null
const submitButton = () => screen.getByRole('button', { name: /withdraw/i })

describe('WithdrawBankReviewView — the optional reference', () => {
    it('SEPA: shows the field with the rail limits, and an empty reference leaves submit enabled', () => {
        renderWithIntl(<Harness rail="sepa" />)
        expect(referenceInput()).toBeInTheDocument()
        expect(referenceInput()).toHaveAttribute('maxlength', '140')
        expect(screen.getByText(/6 to 140 characters/)).toBeInTheDocument()
        expect(submitButton()).toBeEnabled()
    })

    it('a rail with no reference shows no field', () => {
        renderWithIntl(<Harness rail="faster_payments" />)
        expect(referenceInput()).not.toBeInTheDocument()
    })

    it('a reference that breaks the limits disables submit and names the problem after blur', () => {
        renderWithIntl(<Harness rail="sepa" />)
        fireEvent.change(referenceInput()!, { target: { value: 'rent' } })
        expect(submitButton()).toBeDisabled()
        // not an error while the user is still typing
        expect(screen.queryByText(/Use at least 6 characters/)).not.toBeInTheDocument()

        fireEvent.blur(referenceInput()!)
        expect(screen.getByText('Use at least 6 characters, or leave it empty.')).toBeInTheDocument()

        fireEvent.change(referenceInput()!, { target: { value: 'rent #9' } })
        expect(screen.getByText('Use only letters a-z, numbers, spaces and & - . /')).toBeInTheDocument()

        fireEvent.change(referenceInput()!, { target: { value: 'rent september' } })
        expect(submitButton()).toBeEnabled()
    })

    it('ACH: shows its own limits', () => {
        renderWithIntl(<Harness rail="ach" />)
        expect(referenceInput()).toHaveAttribute('maxlength', '10')
        expect(screen.getByText(/Up to 10 characters/)).toBeInTheDocument()
    })

    it('once the on-chain leg fired the reference is locked', () => {
        renderWithIntl(<Harness rail="sepa" submittedTxHash="0xtx" />)
        expect(referenceInput()).toBeDisabled()
    })
})
