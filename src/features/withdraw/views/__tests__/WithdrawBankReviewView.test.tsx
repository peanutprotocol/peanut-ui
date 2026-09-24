import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { WithdrawBankReviewView } from '../WithdrawBankReviewView'
import {
    bankReferenceProblem,
    bankReferenceSpecForRail,
    payoutDefaultReferenceNoteForRail,
    payoutNoteForRail,
} from '../../bank-reference'
import { AccountType, type Account } from '@/interfaces/interfaces'

jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ExchangeRate', () => ({
    __esModule: true,
    default: ({ nonEuroCurrency }: { nonEuroCurrency?: string }) => (
        <div data-testid="exchange-rate" data-currency={nonEuroCurrency ?? ''} />
    ),
}))
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
    account = ibanAccount,
    showError = false,
}: {
    rail: string
    submittedTxHash?: string | null
    account?: Account
    showError?: boolean
}) => {
    const [reference, setReference] = React.useState('')
    const spec = bankReferenceSpecForRail(rail)
    return (
        <WithdrawBankReviewView
            bankAccount={account}
            amount="50"
            fromSendFlow={false}
            isLoading={false}
            isSubmitReady
            submittedTxHash={submittedTxHash}
            error={{ showError, errorMessage: showError ? 'Something went wrong' : '' }}
            balanceErrorMessage={null}
            confirmPendingCopy="processing"
            referenceSpec={spec}
            payoutNoteKey={payoutNoteForRail(rail)}
            payoutDefaultReferenceNoteKey={payoutDefaultReferenceNoteForRail(rail)}
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

    it('SEPA: says what the reference does, and claims nothing about the sender', () => {
        // Our own round trip recorded the user's own legal name as the payout's
        // sender_name, so the old "arrives from our payment partner" claim is
        // gone rather than replaced by the opposite claim.
        renderWithIntl(<Harness rail="sepa" />)
        expect(screen.getByText(/replaces the default text we send/)).toBeInTheDocument()
        expect(screen.queryByText(/arrives from/)).not.toBeInTheDocument()
    })

    it('SEPA: warns that the rail rewrites the spacing and case', () => {
        renderWithIntl(<Harness rail="sepa" />)
        expect(screen.getByText(/spacing and capital letters may change/)).toBeInTheDocument()
    })

    it('a rail we have not measured says nothing about rewriting', () => {
        renderWithIntl(<Harness rail="ach" />)
        expect(screen.queryByText(/spacing and capital letters may change/)).not.toBeInTheDocument()
    })

    it('names who the recipient bank shows as the sender on the rails we can confirm', () => {
        renderWithIntl(<Harness rail="ach" />)
        expect(screen.getByText(/arrives from our payment partner/)).toBeInTheDocument()
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

    it('SEPA: says the default text carries the name only while the user typed none', () => {
        renderWithIntl(<Harness rail="sepa" />)
        expect(screen.getByText(/default text carries your name/)).toBeInTheDocument()

        // A typed reference replaces that whole line — measured on a real
        // transfer (TD-37) — so the sentence goes and the note above it is
        // what tells the user they gave the name up.
        fireEvent.change(referenceInput()!, { target: { value: 'RENT SEPTEMBER' } })
        expect(screen.queryByText(/default text carries your name/)).not.toBeInTheDocument()
        expect(screen.getByText(/replaces the default text we send/)).toBeInTheDocument()
    })

    it('SEPA: whitespace alone is not a reference, so the sentence stays', () => {
        renderWithIntl(<Harness rail="sepa" />)
        fireEvent.change(referenceInput()!, { target: { value: '   ' } })
        expect(screen.getByText(/default text carries your name/)).toBeInTheDocument()
    })
})

/**
 * One country drives the review screen (QA round 3, W1).
 *
 * The flag came off the IBAN while the conversion notice and the exchange rate
 * came off the country picked two screens earlier, so a Portugal resident with
 * a Lithuanian IBAN who picked Poland saw a Lithuanian flag beside a zloty
 * quote. Since the euro area became one destination (Q2) there is often no
 * picked country at all, which would have silently dropped the notice.
 */
describe('WithdrawBankReviewView — the account is the only country on the screen', () => {
    const accountFrom = (countryCode: string) =>
        ({ ...ibanAccount, details: { ...ibanAccount.details, countryCode } }) as unknown as Account

    it('a euro IBAN gets no conversion notice and no local-currency rate', () => {
        renderWithIntl(<Harness rail="sepa" account={accountFrom('DEU')} />)

        expect(screen.queryByText('We send EUR to the bank')).not.toBeInTheDocument()
        expect(screen.getByTestId('exchange-rate')).toHaveAttribute('data-currency', '')
    })

    it('a Polish IBAN gets the zloty rate and the conversion notice, with no country picked', () => {
        renderWithIntl(<Harness rail="sepa" account={accountFrom('POL')} />)

        expect(screen.getByTestId('exchange-rate')).toHaveAttribute('data-currency', 'PLN')
        expect(screen.getByText('We send EUR to the bank')).toBeInTheDocument()
    })

    it("a Lithuanian IBAN is euro, so it never borrows another country's currency", () => {
        // the W1 case: the flag said Lithuania while the rate said zloty
        renderWithIntl(<Harness rail="sepa" account={accountFrom('LTU')} />)

        expect(screen.getByTestId('exchange-rate')).toHaveAttribute('data-currency', '')
        expect(screen.queryByText('We send EUR to the bank')).not.toBeInTheDocument()
    })
})

/**
 * The form stopped asking for a BIC, so a euro account added after that change
 * carries none. An unconditional row read "BIC: N/A" on every new account.
 */
describe('WithdrawBankReviewView — the BIC row', () => {
    it('shows the BIC of a saved account that still carries one', () => {
        renderWithIntl(<Harness rail="sepa" />)

        expect(screen.getByText('BIC')).toBeInTheDocument()
        expect(screen.getByText('COBADEFFXXX')).toBeInTheDocument()
    })

    it('leaves the row out for an account with no BIC, rather than showing N/A', () => {
        const noBic = { ...ibanAccount, bic: undefined } as unknown as Account
        renderWithIntl(<Harness rail="sepa" account={noBic} />)

        expect(screen.queryByText('BIC')).not.toBeInTheDocument()
        expect(screen.queryByText('N/A')).not.toBeInTheDocument()
    })
})

/**
 * TASK-18624: withdrawing to someone else's account (a parent's) showed the
 * user as the account owner, because a missing stored name fell back to the
 * viewer's own name.
 */
describe('WithdrawBankReviewView — the account owner row', () => {
    it("shows the holder name stored on the account, not the user's", () => {
        const mothersAccount = {
            ...ibanAccount,
            details: { ...ibanAccount.details, accountOwnerName: 'Maria Montenegro' },
        } as unknown as Account
        renderWithIntl(<Harness rail="sepa" account={mothersAccount} />)

        expect(screen.getByText('Account owner')).toBeInTheDocument()
        expect(screen.getByText('Maria Montenegro')).toBeInTheDocument()
        expect(screen.queryByText('Anna Rossi')).not.toBeInTheDocument()
    })

    it("leaves the row out when no holder name was stored, rather than showing the user's name", () => {
        const noOwner = {
            ...ibanAccount,
            details: { ...ibanAccount.details, accountOwnerName: '' },
        } as unknown as Account
        renderWithIntl(<Harness rail="sepa" account={noOwner} />)

        expect(screen.queryByText('Account owner')).not.toBeInTheDocument()
        expect(screen.queryByText('Anna Rossi')).not.toBeInTheDocument()
    })
})
