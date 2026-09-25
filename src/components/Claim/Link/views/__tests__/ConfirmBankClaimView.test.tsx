/**
 * TASK-23054: the claim-to-bank confirm screen read the currency off the
 * account's COUNTRY, so a UK IBAN showed a GBP rate while the claim's transfer
 * (getOfframpConfigFromAccount, on this same object) paid EUR over SEPA.
 */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { type ClaimLinkData } from '@/services/sendLinks'
import { AccountType } from '@/interfaces/interfaces'
import { ConfirmBankClaimView } from '../Confirm.bank-claim.view'

const mockRateFor = jest.fn()
jest.mock('@/hooks/useGetExchangeRate', () => ({
    __esModule: true,
    default: ({ accountType }: { accountType: AccountType }) => mockRateFor(accountType),
}))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))

const RATES: Record<string, string> = { iban: '0.8955', gb: '0.7508', us: '1' }

const details = (overrides: Partial<IBankAccountDetails>) =>
    ({
        firstName: 'Anna',
        lastName: 'Rossi',
        email: '',
        accountNumber: '',
        routingNumber: '',
        sortCode: '',
        clabe: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        iban: '',
        country: 'GBR',
        ...overrides,
    }) as IBankAccountDetails

const renderConfirm = (bankDetails: IBankAccountDetails) =>
    renderWithIntl(
        <ConfirmBankClaimView
            onConfirm={jest.fn()}
            onBack={jest.fn()}
            bankDetails={bankDetails}
            fullName="Anna Rossi"
            claimLinkData={{ amount: 5000000n, tokenDecimals: 6, tokenSymbol: 'USDC' } as unknown as ClaimLinkData}
        />
    )

beforeEach(() => {
    mockRateFor.mockImplementation((accountType: string) => ({
        exchangeRate: RATES[accountType] ?? null,
        isFetchingRate: false,
    }))
})

describe('ConfirmBankClaimView — the rate is in the currency the transfer pays', () => {
    it('a UK IBAN shows the EUR rate, never GBP', () => {
        renderConfirm(details({ type: 'iban', iban: 'GB31PRTC00000000000000' }))
        expect(mockRateFor).toHaveBeenCalledWith(AccountType.IBAN)
        expect(screen.getByText('1 USD = 0.8955 EUR')).toBeInTheDocument()
        expect(screen.queryByText(/GBP/)).not.toBeInTheDocument()
    })

    it('a UK sort-code account shows the GBP rate', () => {
        renderConfirm(details({ type: 'gb', accountNumber: '12345678', sortCode: '123456' }))
        expect(screen.getByText('1 USD = 0.7508 GBP')).toBeInTheDocument()
    })
})
