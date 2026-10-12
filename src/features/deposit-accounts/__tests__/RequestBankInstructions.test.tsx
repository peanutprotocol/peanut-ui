import { ToastProvider } from '@/components/0_Bruddle/Toast'
import type { RequestDepositInstructions } from '@/services/services.types'
import { IntlWrapper } from '@/test-utils/intl'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RequestBankInstructions } from '../components/RequestBankInstructions'

const useExchangeRate = jest.fn()
jest.mock('@/hooks/useExchangeRate', () => ({
    useExchangeRate: (...args: unknown[]) => useExchangeRate(...args),
}))

const instructions = (currency: string, railId: string, sender = 'anyone'): RequestDepositInstructions =>
    ({
        paymentReference: 'PNT-8842',
        depositAccount: {
            id: 'acc-1',
            country: 'DE',
            currency,
            railId,
            isPrimary: true,
            status: 'active',
            matching: { nameOnAccount: 'user', sender },
            instructions: { accountHolderName: 'Ana Silva', iban: 'DE89370400440532013000', paymentRails: ['sepa'] },
        },
    }) as RequestDepositInstructions

const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlWrapper>
        <ToastProvider>{children}</ToastProvider>
    </IntlWrapper>
)

const renderInstructions = (currency: string, railId: string, usdAmount?: string, sender = 'anyone') =>
    render(<RequestBankInstructions instructions={instructions(currency, railId, sender)} usdAmount={usdAmount} />, {
        wrapper,
    })

beforeEach(() => {
    jest.clearAllMocks()
    useExchangeRate.mockReturnValue({ exchangeRate: 0 })
})

describe('RequestBankInstructions', () => {
    it('always shows the reference the deposit has to carry', () => {
        renderInstructions('EUR', 'sepa_eu')

        expect(screen.getByText('PNT-8842')).toBeInTheDocument()
    })

    describe('the amount the payer sends', () => {
        // A payer typing a dollar figure into a euro transfer sends the wrong
        // money, so the row states the account's own currency.
        // Cross-currency is an estimate off the client's indicative rate, so it
        // is shown with a ≈ and framed as approximate — never as an exact figure.
        it('converts the requested dollars at the live rate, marked as an estimate', () => {
            useExchangeRate.mockReturnValue({ exchangeRate: 0.92 })

            renderInstructions('EUR', 'sepa_eu', '250')

            expect(screen.getByText('≈ €230')).toBeInTheDocument()
            expect(screen.getByText(/Estimated at today’s rate/)).toBeInTheDocument()
        })

        it('reads the rate for the account currency, not for the request', () => {
            useExchangeRate.mockReturnValue({ exchangeRate: 1350 })

            renderInstructions('ARS', 'transfer_ar', '10')

            expect(useExchangeRate).toHaveBeenCalledWith(
                expect.objectContaining({ sourceCurrency: 'USD', destinationCurrency: 'ARS' })
            )
            expect(screen.getByText('≈ ARS 13,500')).toBeInTheDocument()
        })

        // Rounding down would leave the request short of what it asked for.
        it('rounds up to the smallest unit the currency has', () => {
            useExchangeRate.mockReturnValue({ exchangeRate: 0.9237 })

            renderInstructions('EUR', 'sepa_eu', '250')

            expect(screen.getByText('≈ €230.93')).toBeInTheDocument()
        })

        it('passes a dollar account through as an exact, copyable amount', () => {
            render(
                <RequestBankInstructions
                    instructions={instructions('USD', 'ach_us')}
                    usdAmount="250"
                    remainingUsd={250}
                />,
                { wrapper }
            )

            expect(screen.getByText('$250')).toBeInTheDocument()
            expect(screen.getByText('Send this amount and the request is marked paid.')).toBeInTheDocument()
            expect(useExchangeRate).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
        })

        // A wrong number is worse than no number: the payer would send it.
        it('shows no amount while the rate is still unknown', () => {
            renderInstructions('EUR', 'sepa_eu', '250')

            expect(screen.queryByText('Amount to send')).not.toBeInTheDocument()
        })

        it('shows no amount on a request that asks for none', () => {
            useExchangeRate.mockReturnValue({ exchangeRate: 0.92 })

            renderInstructions('EUR', 'sepa_eu')

            expect(screen.queryByText('Amount to send')).not.toBeInTheDocument()
        })

        it('keeps the amount and the reference in one card', () => {
            renderInstructions('USD', 'ach_us', '250')

            const amountRow = screen.getByText('Amount to send').closest('.ds-data-row')
            const referenceRow = screen.getByText('Payment reference').closest('.ds-data-row')
            expect(amountRow?.parentElement).toBe(referenceRow?.parentElement)
        })
    })

    // The API states what settles the rest of the request. A payer can type
    // their own contribution, and then the API figure is not what they pay.
    describe('the amount the API states', () => {
        const eurEstimate = {
            amount: '92.00',
            currency: 'EUR',
            isEstimate: true,
            rate: { from: 'USD', to: 'EUR', rate: '0.92', source: 'bridge', asOf: null },
        }
        const renderWithServerAmount = (
            payerAmount: unknown,
            props: { usdAmount?: string; remainingUsd?: number } = {}
        ) =>
            render(
                <RequestBankInstructions
                    instructions={{ ...instructions('EUR', 'sepa_eu'), payerAmount } as RequestDepositInstructions}
                    {...props}
                />,
                { wrapper }
            )

        it('shows the API estimate when the payer typed nothing, and reads no client rate', () => {
            renderWithServerAmount(eurEstimate, { remainingUsd: 100 })

            expect(screen.getByText('≈ €92')).toBeInTheDocument()
            expect(screen.getByText(/Estimated at today’s rate/)).toBeInTheDocument()
            expect(useExchangeRate).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
        })

        // The overpayment bug: $20 into a $100 request showed the full 92 EUR.
        it('shows the payer their own contribution, not the whole request', () => {
            renderWithServerAmount(eurEstimate, { usdAmount: '20', remainingUsd: 100 })

            expect(screen.getByText('≈ €18.40')).toBeInTheDocument()
            expect(screen.queryByText('≈ €92')).not.toBeInTheDocument()
        })

        it('shows an exact same-currency amount as copyable when the payer pays the rest', () => {
            renderWithServerAmount(
                { amount: '100.00', currency: 'EUR', isEstimate: false },
                { usdAmount: '108', remainingUsd: 108 }
            )

            expect(screen.getByText('€100')).toBeInTheDocument()
            expect(screen.getByText('Send this amount and the request is marked paid.')).toBeInTheDocument()
        })

        // A part of an exact amount is a conversion again, so it is an estimate
        // and it never promises "paid".
        it('marks a part of an exact amount as an estimate', () => {
            renderWithServerAmount(
                { amount: '100.00', currency: 'EUR', isEstimate: false },
                { usdAmount: '27', remainingUsd: 108 }
            )

            expect(screen.getByText('≈ €25')).toBeInTheDocument()
            expect(screen.queryByText('Send this amount and the request is marked paid.')).not.toBeInTheDocument()
        })

        it('never rounds the API figure down', () => {
            renderWithServerAmount({ amount: '91.991', currency: 'EUR', isEstimate: true }, { remainingUsd: 100 })

            expect(screen.getByText('≈ €92')).toBeInTheDocument()
        })

        it('states dollars and says the bank converts when the API has no figure', () => {
            renderWithServerAmount({ amount: null, currency: 'EUR', isEstimate: true }, { usdAmount: '20' })

            expect(screen.getByText('$20')).toBeInTheDocument()
            expect(screen.getByText(/There is no EUR estimate right now/)).toBeInTheDocument()
            expect(useExchangeRate).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
        })

        it('does not present a figure in another currency than the account', () => {
            useExchangeRate.mockReturnValue({ exchangeRate: 0.92 })
            renderWithServerAmount({ amount: '80.00', currency: 'GBP', isEstimate: false }, { usdAmount: '250' })

            expect(screen.getByText('≈ €230')).toBeInTheDocument()
            expect(screen.queryByText(/GBP/)).not.toBeInTheDocument()
        })

        it('falls back to the client conversion for a malformed API amount', () => {
            useExchangeRate.mockReturnValue({ exchangeRate: 0.92 })
            renderWithServerAmount({ amount: 'not-a-number' }, { usdAmount: '250' })

            expect(screen.getByText('≈ €230')).toBeInTheDocument()
        })
    })

    // A payer must read who may pay BEFORE they send: a personal transfer into a
    // business-only or unconfirmed corridor is returned.
    describe('who may pay this', () => {
        it('warns the payer on a business-only corridor', () => {
            renderInstructions('EUR', 'sepa_eu', undefined, 'business-only')

            expect(screen.getByText(/Only the account holder or a business can pay in/)).toBeInTheDocument()
        })

        it('warns the payer where the corridor confirms no third-party policy', () => {
            renderInstructions('EUR', 'sepa_eu', undefined, 'unknown')

            expect(screen.getByText(/has not confirmed transfers from other people/)).toBeInTheDocument()
        })

        it('shows no warning on a corridor anyone can pay', () => {
            renderInstructions('EUR', 'sepa_eu', undefined, 'anyone')

            expect(screen.queryByText(/can pay this/)).not.toBeInTheDocument()
            expect(screen.queryByText(/may be returned/)).not.toBeInTheDocument()
        })
    })
})
