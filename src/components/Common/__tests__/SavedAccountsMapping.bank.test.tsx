/**
 * A PIX key saved to favorites after a payment keeps the bank the PIX directory
 * named, and its row shows it under the key (TASK-23738). Other saved accounts
 * keep their rows as they were.
 */
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { AccountType, type Account } from '@/interfaces/interfaces'
import { SavedAccountsMapping } from '../SavedAccountsView'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const pixKey = (overrides: Partial<Account> = {}): Account =>
    ({
        id: 'acc-pix',
        type: AccountType.MANTECA,
        identifier: 'maria@silva.com.br',
        label: 'Maria',
        details: { bankName: 'NU PAGAMENTOS S.A.', countryCode: 'BRA', countryName: 'brazil' },
        isPixRecipient: true,
        ...overrides,
    }) as unknown as Account

const renderRows = (accounts: Account[]) =>
    render(<SavedAccountsMapping accounts={accounts} onItemClick={() => {}} />, { wrapper: IntlWrapper })

describe('SavedAccountsMapping — the bank of a saved PIX key', () => {
    it('shows the bank on its own line under the key', () => {
        renderRows([pixKey()])
        expect(screen.getByText('maria@silva.com.br')).toBeInTheDocument()
        expect(screen.getByText('NU PAGAMENTOS S.A.')).toBeInTheDocument()
    })

    it('shows the key alone when no bank was kept', () => {
        renderRows([
            pixKey({ details: { bankName: null, countryCode: 'BRA', countryName: 'brazil' } } as Partial<Account>),
        ])
        expect(screen.getByText('maria@silva.com.br')).toBeInTheDocument()
        expect(screen.queryByText(/NU PAGAMENTOS/)).not.toBeInTheDocument()
    })

    it("leaves the user's own accounts as they were, even when they name a bank", () => {
        renderRows([pixKey({ isPixRecipient: false })])
        expect(screen.queryByText(/NU PAGAMENTOS/)).not.toBeInTheDocument()
    })
})
