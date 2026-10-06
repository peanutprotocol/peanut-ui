import React from 'react'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CurrencyBalanceNotice } from '../CurrencyBalanceNotice'
import en from '@/i18n/app/messages/en.json'

const mockAuth = jest.fn()
const mockWallet = jest.fn()
const mockEuroBalance = jest.fn()
const mockList = jest.fn()
const mockRate = jest.fn()
jest.mock('@/context/authContext', () => ({ useOptionalAuth: () => mockAuth() }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => mockWallet() }))
jest.mock('@/hooks/wallet/useCurrencyAccounts', () => ({
    currencyAccountsKey: (owner: string) => ['currency-accounts', owner],
    eurcBalanceQueryOptions: (owner: string, account: unknown) => ({
        queryKey: ['eurc-balance', owner],
        queryFn: mockEuroBalance,
        enabled: !!account,
        retry: false,
    }),
}))
jest.mock('@/services/currency-accounts', () => ({
    currencyAccountsApi: { list: () => mockList(), exchangeRate: (from: string) => mockRate(from) },
}))
jest.mock('@/i18n/app/useAppTranslations', () => ({
    useAppTranslations:
        () =>
        (key: keyof typeof en.currencyAccounts, values: Record<string, string> = {}) =>
            en.currencyAccounts[key].replace(/\{(\w+)\}/g, (_, name) => values[name]),
}))
jest.mock('@/components/0_Bruddle/LinkButton', () => ({
    LinkButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))
let client: QueryClient
beforeEach(() => {
    jest.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
    mockAuth.mockReturnValue({ userId: 'alice' })
    mockWallet.mockReturnValue({ spendableBalance: 10_000_000n, isFetchingSpendableBalance: false })
    mockList.mockResolvedValue({ accounts: [{ asset: 'EURC' }] })
    mockEuroBalance.mockResolvedValue(20_000_000n)
    mockRate.mockResolvedValue({ midmarket_rate: '1.1', indicative: true })
})
afterEach(() => {
    cleanup()
    client.clear()
})
const show = (currency: 'EURC' | 'USDC', amount: string) =>
    render(
        <QueryClientProvider client={client}>
            <CurrencyBalanceNotice currency={currency} amount={amount} showSelectedBalance={currency === 'EURC'} />
        </QueryClientProvider>
    )
it('shows converted euros below the dollar balance only on a dollar shortfall', async () => {
    show('USDC', '50')
    expect(await screen.findByText('Total across accounts: ≈ 32.00 USD')).toBeInTheDocument()
    expect(mockRate).toHaveBeenCalledWith('EURC')
    expect(screen.getByText('Exchange before sending. Rates and fees may vary.')).toBeInTheDocument()
})
it('uses the opposite quote for euro sends and preserves the selected token balance', async () => {
    mockRate.mockResolvedValue({ midmarket_rate: '0.9', indicative: true })
    show('EURC', '25')
    expect(await screen.findByText('Balance: 20 EURC')).toBeInTheDocument()
    expect(await screen.findByText('Total across accounts: ≈ 29.00 EUR')).toBeInTheDocument()
    expect(mockRate).toHaveBeenCalledWith('USDC')
})
it.each(['5', '10', '', '0', '1e3'])(
    'does not request rates when the amount %s has no valid shortfall',
    async (amount) => {
        show('USDC', amount)
        await waitFor(() => expect(mockEuroBalance).toHaveBeenCalled())
        expect(mockRate).not.toHaveBeenCalled()
        expect(screen.queryByText(/Total across accounts/)).not.toBeInTheDocument()
    }
)
it('preserves USDC-only accounts without Base or pricing requests', async () => {
    mockList.mockResolvedValue({ accounts: [{ asset: 'USDC' }] })
    show('USDC', '50')
    await waitFor(() => expect(mockList).toHaveBeenCalled())
    expect(mockEuroBalance).not.toHaveBeenCalled()
    expect(mockRate).not.toHaveBeenCalled()
    expect(screen.queryByText(/Total across accounts/)).not.toBeInTheDocument()
})
it('never adds a partial or unreadable other balance', async () => {
    mockEuroBalance.mockRejectedValue(new Error('RPC unavailable'))
    show('USDC', '50')
    expect(await screen.findByText('Total balance is unavailable. Try again.')).toBeInTheDocument()
    expect(mockRate).not.toHaveBeenCalled()
    expect(screen.queryByText(/Total across accounts/)).not.toBeInTheDocument()
})
it('removes a cached total when a refreshed rate fails', async () => {
    show('USDC', '50')
    await screen.findByText('Total across accounts: ≈ 32.00 USD')
    mockRate.mockRejectedValue(new Error('Provider unavailable'))
    await act(async () => {
        await client.invalidateQueries({ queryKey: ['currency-rate'] })
    })
    expect(await screen.findByText('Total balance is unavailable. Try again.')).toBeInTheDocument()
    expect(screen.queryByText(/32.00 USD/)).not.toBeInTheDocument()
})
it('waits for both dollar balance sources before estimating a euro total', async () => {
    mockWallet.mockReturnValue({ spendableBalance: 10_000_000n, isFetchingSpendableBalance: true })
    show('EURC', '25')
    await screen.findByText('Balance: 20 EURC')
    expect(screen.getByText('Calculating total balance…')).toBeInTheDocument()
    expect(mockRate).not.toHaveBeenCalled()
})
it('does not load account balances for a signed-out visitor', () => {
    mockAuth.mockReturnValue(null)
    show('USDC', '50')
    expect(mockList).not.toHaveBeenCalled()
    expect(mockWallet).not.toHaveBeenCalled()
})
