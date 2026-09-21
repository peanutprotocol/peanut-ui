import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { WithdrawBankReviewView } from '../WithdrawBankReviewView'
import { bankReferenceProblem, bankReferenceSpecForRail, payoutSenderNoteForRail } from '../../bank-reference'
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
const Harness = ({
    rail,
    submittedTxHash = null,
    showError = false,
}: {
    rail: string
    submittedTxHash?: string | null
    showError?: boolean
}) => {
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
            error={{ showError, errorMessage: showError ? 'Something went wrong' : '' }}
            balanceErrorMessage={null}
            confirmPendingCopy="processing"
            referenceSpec={spec}
            payoutSenderNoteKey={payoutSenderNoteForRail(rail)}
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
        renderWithIntl(<Harness rail="wire" />)
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

    it('Faster Payments: shows its own limits', () => {
        renderWithIntl(<Harness rail="faster_payments" />)
        expect(referenceInput()).toHaveAttribute('maxlength', '18')
        expect(screen.getByText(/Up to 18 characters/)).toBeInTheDocument()
    })

    it('SPEI: shows its own limits and refuses punctuation', () => {
        renderWithIntl(<Harness rail="spei" />)
        expect(referenceInput()).toHaveAttribute('maxlength', '40')
        expect(screen.getByText(/Up to 40 characters/)).toBeInTheDocument()

        fireEvent.change(referenceInput()!, { target: { value: 'RENTA-09' } })
        expect(submitButton()).toBeDisabled()
        fireEvent.blur(referenceInput()!)
        expect(screen.getByText('Use only letters a-z, numbers and spaces.')).toBeInTheDocument()

        fireEvent.change(referenceInput()!, { target: { value: 'RENTA 09 2026' } })
        expect(submitButton()).toBeEnabled()
    })

    it('Colombia: shows its own limits', () => {
        renderWithIntl(<Harness rail="co_bank_transfer" />)
        expect(referenceInput()).toHaveAttribute('maxlength', '18')
        expect(screen.getByText(/Up to 18 characters/)).toBeInTheDocument()
    })

    it('an over-length reference blocks submit on every rail that takes one', () => {
        // maxLength stops typing past the ceiling, so drive the value directly.
        for (const [rail, over] of [
            ['faster_payments', 'x'.repeat(19)],
            ['spei', 'x'.repeat(41)],
            ['co_bank_transfer', 'x'.repeat(19)],
        ] as const) {
            const { unmount } = renderWithIntl(<Harness rail={rail} />)
            fireEvent.change(referenceInput()!, { target: { value: over } })
            expect(submitButton()).toBeDisabled()
            unmount()
        }
    })

    it('once the on-chain leg fired the reference is locked', () => {
        renderWithIntl(<Harness rail="sepa" submittedTxHash="0xtx" />)
        expect(referenceInput()).toBeDisabled()
    })

    it('names who the recipient bank shows as the sender, per rail', () => {
        renderWithIntl(<Harness rail="sepa" />)
        expect(screen.getByText(/arrives from our payment partner/)).toBeInTheDocument()
        expect(screen.getByText(/Your name is in the payment reference/)).toBeInTheDocument()
    })

    it('says nothing about the sender on a rail we cannot confirm', () => {
        // Faster Payments is absent from the provider's payout configuration.
        renderWithIntl(<Harness rail="faster_payments" />)
        expect(screen.queryByText(/arrives from/)).not.toBeInTheDocument()
    })

    it('Retry is disabled while the reference breaks the rail limits', () => {
        // The flow hook returns early on a reference problem, so an enabled
        // Retry here is a button that looks live and does nothing.
        renderWithIntl(<Harness rail="sepa" showError />)
        const retry = screen.getByRole('button', { name: /retry/i })
        expect(retry).toBeEnabled()

        fireEvent.change(referenceInput()!, { target: { value: 'rent' } })
        expect(screen.getByRole('button', { name: /retry/i })).toBeDisabled()
    })

    it('names the reference problem in the error state without waiting for a blur', () => {
        // The user already submitted once, so there is nothing left to "finish
        // typing" — hiding the reason would leave a dead Retry unexplained.
        renderWithIntl(<Harness rail="sepa" showError />)
        fireEvent.change(referenceInput()!, { target: { value: 'rent' } })
        expect(screen.getByText('Use at least 6 characters, or leave it empty.')).toBeInTheDocument()
    })
})
