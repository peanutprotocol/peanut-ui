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

            expect(screen.getByText('≈ 230.00 EUR')).toBeInTheDocument()
            expect(screen.getByText(/Estimated at today’s rate/)).toBeInTheDocument()
        })

        it('reads the rate for the account currency, not for the request', () => {
            useExchangeRate.mockReturnValue({ exchangeRate: 1350 })

            renderInstructions('ARS', 'transfer_ar', '10')

            expect(useExchangeRate).toHaveBeenCalledWith(
                expect.objectContaining({ sourceCurrency: 'USD', destinationCurrency: 'ARS' })
            )
            expect(screen.getByText('≈ 13,500.00 ARS')).toBeInTheDocument()
        })

        // Rounding down would leave the request short of what it asked for.
        it('rounds up to the smallest unit the currency has', () => {
            useExchangeRate.mockReturnValue({ exchangeRate: 0.9237 })

            renderInstructions('EUR', 'sepa_eu', '250')

            expect(screen.getByText('≈ 230.93 EUR')).toBeInTheDocument()
        })

        it('passes a dollar account through as an exact, copyable amount', () => {
            renderInstructions('USD', 'ach_us', '250')

            expect(screen.getByText('250.00 USD')).toBeInTheDocument()
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
    })

    // A payer must read who may pay BEFORE they send: a personal transfer into a
    // business-only or unconfirmed corridor is returned.
    describe('who may pay this', () => {
        it('warns the payer on a business-only corridor', () => {
            renderInstructions('EUR', 'sepa_eu', undefined, 'business-only')

            expect(screen.getByText(/Only a business account can pay this/)).toBeInTheDocument()
        })

        it('warns the payer where the corridor confirms no third-party policy', () => {
            renderInstructions('EUR', 'sepa_eu', undefined, 'unknown')

            expect(screen.getByText(/has not confirmed it accepts payments from other people/)).toBeInTheDocument()
        })

        it('shows no warning on a corridor anyone can pay', () => {
            renderInstructions('EUR', 'sepa_eu', undefined, 'anyone')

            expect(screen.queryByText(/can pay this/)).not.toBeInTheDocument()
            expect(screen.queryByText(/may be returned/)).not.toBeInTheDocument()
        })
    })
})
