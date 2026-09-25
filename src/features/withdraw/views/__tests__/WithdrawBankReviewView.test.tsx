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
import { getBankPayout } from '@/utils/bridge.utils'

jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: ({ amountDisplay, secondaryAmount }: { amountDisplay?: string; secondaryAmount?: string }) => (
        <div>
            <p data-testid="headline">{amountDisplay}</p>
            <p data-testid="secondary">{secondaryAmount ?? ''}</p>
        </div>
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
    bankAmount,
    onRetryQuote,
    isSubmitReady = true,
    onAddBankAccountAgain,
}: {
    rail: string
    submittedTxHash?: string | null
    account?: Account
    showError?: boolean
    bankAmount?: { amount?: string; rate?: string; enteredInBankCurrency: boolean }
    onRetryQuote?: () => void
    isSubmitReady?: boolean
    onAddBankAccountAgain?: () => void
}) => {
    const [reference, setReference] = React.useState('')
    const spec = bankReferenceSpecForRail(rail)
    // the currency comes from the account, the way the flow hook builds it
    const { currency, bankConvertsTo } = getBankPayout(account)
    return (
        <WithdrawBankReviewView
            bankAccount={account}
            amount="50"
            payout={{ currency, bankConvertsTo, enteredInBankCurrency: false, ...bankAmount }}
            isRateLoading={false}
            fromSendFlow={false}
            isLoading={false}
            isSubmitReady={isSubmitReady}
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
            onRetryQuote={onRetryQuote}
            onAddBankAccountAgain={onAddBankAccountAgain}
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

    it('a saved account the provider refused offers to add a bank account instead of Retry (TASK-23054)', () => {
        const onAddBankAccountAgain = jest.fn()
        renderWithIntl(<Harness rail="sepa" showError onAddBankAccountAgain={onAddBankAccountAgain} />)
        expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Add new bank account' }))
        expect(onAddBankAccountAgain).toHaveBeenCalled()
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
 * The account decides the payout, the way the transfer does (TASK-23054).
 *
 * The flag comes off the IBAN, never off the country picked upstream (QA round
 * 3, W1). The currency comes off the account TYPE: Bridge pays GBP only to a
 * sort-code account, and every IBAN is paid EUR over SEPA, even in the UK.
 */
describe('WithdrawBankReviewView — the account is the only country on the screen', () => {
    const accountFrom = (countryCode: string, type = AccountType.IBAN) =>
        ({ ...ibanAccount, type, details: { ...ibanAccount.details, countryCode } }) as unknown as Account

    it('a euro IBAN gets a EUR rate and no conversion notice', () => {
        renderWithIntl(
            <Harness
                rail="sepa"
                account={accountFrom('DEU')}
                bankAmount={{ rate: '0.8955', enteredInBankCurrency: false }}
            />
        )

        expect(screen.queryByText('We send EUR to the bank')).not.toBeInTheDocument()
        expect(screen.getByText('1 USD = 0.8955 EUR')).toBeInTheDocument()
    })

    it.each([
        ['GBR', 'the UK'],
        ['POL', 'Poland'],
        ['SWE', 'Sweden'],
        ['CHE', 'Switzerland'],
    ])('an IBAN from %s (%s) is paid EUR: EUR rate and amount, and the conversion notice', (countryCode) => {
        // Konrad, 2026-09-25: a UK IBAN quoted "1 USD = 0.7508 GBP" and "≈ £…"
        // while the transfer paid EUR over SEPA
        renderWithIntl(
            <Harness
                rail="sepa"
                account={accountFrom(countryCode)}
                bankAmount={{ rate: '0.8955', amount: '44.78', enteredInBankCurrency: false }}
            />
        )

        expect(screen.getByText('1 USD = 0.8955 EUR')).toBeInTheDocument()
        expect(screen.getByTestId('secondary')).toHaveTextContent('≈ €44.78')
        expect(screen.queryByText(/GBP|PLN|SEK|CHF|£/)).not.toBeInTheDocument()
        expect(screen.getByText('We send EUR to the bank')).toBeInTheDocument()
    })

    it('a UK sort-code account is paid GBP: GBP rate, no EUR notice', () => {
        renderWithIntl(
            <Harness
                rail="faster_payments"
                account={accountFrom('GBR', AccountType.GB)}
                bankAmount={{ rate: '0.7508', amount: '37.54', enteredInBankCurrency: false }}
            />
        )

        expect(screen.getByText('1 USD = 0.7508 GBP')).toBeInTheDocument()
        expect(screen.getByTestId('secondary')).toHaveTextContent('≈ £37.54')
        expect(screen.queryByText('We send EUR to the bank')).not.toBeInTheDocument()
    })

    it("a Lithuanian IBAN is euro, so it never borrows another country's currency", () => {
        // the W1 case: the flag said Lithuania while the rate said zloty
        renderWithIntl(
            <Harness
                rail="sepa"
                account={accountFrom('LTU')}
                bankAmount={{ rate: '0.8955', enteredInBankCurrency: false }}
            />
        )

        expect(screen.getByText('1 USD = 0.8955 EUR')).toBeInTheDocument()
        expect(screen.queryByText('We send EUR to the bank')).not.toBeInTheDocument()
    })

    it('a US account converts nothing: no rate row, one amount', () => {
        renderWithIntl(<Harness rail="ach" account={accountFrom('USA', AccountType.US)} />)

        expect(screen.queryByText('Exchange rate')).not.toBeInTheDocument()
        expect(screen.getByTestId('headline')).toHaveTextContent('$50')
        expect(screen.getByTestId('secondary')).toBeEmptyDOMElement()
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

describe('WithdrawBankReviewView — the amount leads in the currency the user typed (TASK-23054)', () => {
    it('typed in EUR: the bank amount leads, the USD from the balance follows', () => {
        renderWithIntl(
            <Harness rail="sepa" bankAmount={{ amount: '2000', rate: '0.8955', enteredInBankCurrency: true }} />
        )
        expect(screen.getByTestId('headline')).toHaveTextContent('≈ €2,000')
        expect(screen.getByTestId('secondary')).toHaveTextContent('$50')
        expect(screen.getByText('1 USD = 0.8955 EUR')).toBeInTheDocument()
    })

    it('typed in USD: the USD leads, the bank amount follows as an estimate', () => {
        renderWithIntl(
            <Harness rail="sepa" bankAmount={{ amount: '44.78', rate: '0.8955', enteredInBankCurrency: false }} />
        )
        expect(screen.getByTestId('headline')).toHaveTextContent('$50')
        expect(screen.getByTestId('secondary')).toHaveTextContent('≈ €44.78')
    })

    it('before the first rate loads, shows the USD alone', () => {
        renderWithIntl(<Harness rail="sepa" />)
        expect(screen.getByTestId('headline')).toHaveTextContent('$50')
        expect(screen.getByTestId('secondary')).toBeEmptyDOMElement()
    })

    // a failed 30-second refresh: the review, and any step open over it, stays
    it('a failed quote refresh is an inline error with a retry, on the same review', () => {
        const onRetryQuote = jest.fn()
        renderWithIntl(
            <Harness
                rail="sepa"
                bankAmount={{ amount: '2000', rate: '0.8955', enteredInBankCurrency: true }}
                onRetryQuote={onRetryQuote}
            />
        )
        expect(screen.getByTestId('headline')).toHaveTextContent('≈ €2,000')
        expect(
            screen.getByText('Exchange rates are temporarily unavailable. Please try again in a moment.')
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        expect(onRetryQuote).toHaveBeenCalled()
    })

    // Chip: a failed submit, then a failed quote refresh — the submit Retry must
    // not look live while the flow refuses the quote that is no longer current
    it('after a failed submit, the submit Retry waits for a current quote; the quote Retry stays live', () => {
        const onRetryQuote = jest.fn()
        renderWithIntl(
            <Harness
                rail="sepa"
                showError
                isSubmitReady={false}
                bankAmount={{ amount: '2000', rate: '0.8955', enteredInBankCurrency: true }}
                onRetryQuote={onRetryQuote}
            />
        )
        const [quoteRetry, submitRetry] = screen.getAllByRole('button', { name: /retry/i })
        expect(submitRetry).toBeDisabled()
        expect(quoteRetry).toBeEnabled()
    })
})
