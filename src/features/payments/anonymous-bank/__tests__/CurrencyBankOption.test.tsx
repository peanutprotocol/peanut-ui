import { ToastProvider } from '@/components/0_Bruddle/Toast'
import type { RequestDepositInstructions } from '@/services/services.types'
import { IntlWrapper } from '@/test-utils/intl'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CurrencyBankOption } from '../CurrencyBankOption'

const useExchangeRate = jest.fn()
jest.mock('@/hooks/useExchangeRate', () => ({
    useExchangeRate: (...args: unknown[]) => useExchangeRate(...args),
}))

beforeAll(() => {
    // vaul reads matchMedia when a Drawer opens; jsdom has none.
    window.matchMedia =
        window.matchMedia ||
        ((query: string) =>
            ({
                matches: false,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
                onchange: null,
            }) as MediaQueryList)
})

const instructions = (currency: string, railId: string): RequestDepositInstructions =>
    ({
        paymentReference: 'PNT-8842',
        depositAccount: {
            id: 'acc-1',
            country: 'DE',
            currency,
            railId,
            isPrimary: true,
            status: 'active',
            matching: { nameOnAccount: 'user', sender: 'business-only' },
            instructions: { accountHolderName: 'Ana Silva', iban: 'DE89370400440532013000', paymentRails: ['sepa'] },
        },
    }) as RequestDepositInstructions

const wrapper = ({ children }: { children: ReactNode }) => (
    <IntlWrapper>
        <ToastProvider>{children}</ToastProvider>
    </IntlWrapper>
)

beforeEach(() => {
    jest.clearAllMocks()
    useExchangeRate.mockReturnValue({ exchangeRate: 1.1 })
})

describe('CurrencyBankOption', () => {
    it('leads the row with the currency and the rail, not a generic "bank"', () => {
        render(<CurrencyBankOption instructions={instructions('EUR', 'bridge.sepa_eu')} />, { wrapper })
        expect(screen.getByText('Pay in EUR · SEPA')).toBeInTheDocument()
    })

    it('names each corridor with its own rail', () => {
        render(<CurrencyBankOption instructions={instructions('USD', 'bridge.ach_us')} />, { wrapper })
        expect(screen.getByText('Pay in USD · ACH or wire')).toBeInTheDocument()
    })

    it('falls back to the plain title when the rail id cannot be mapped', () => {
        render(<CurrencyBankOption instructions={instructions('EUR', 'unknown')} />, { wrapper })
        expect(screen.getByText('Pay by bank transfer')).toBeInTheDocument()
    })

    it('reveals the bank details, the amount to send and the reference on tap', () => {
        render(<CurrencyBankOption instructions={instructions('EUR', 'bridge.sepa_eu')} usdAmount="250" />, {
            wrapper,
        })

        fireEvent.click(screen.getByTestId('currency-bank-option'))

        expect(screen.getByText('DE89370400440532013000')).toBeInTheDocument()
        expect(screen.getByText('Amount to send')).toBeInTheDocument()
        expect(screen.getByText('PNT-8842')).toBeInTheDocument()
    })
})
