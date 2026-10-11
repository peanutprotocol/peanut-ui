import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { fail, io, ok, rainOverview, resetIo } from '@/test-utils/balance-io'
import { CurrencyBalanceNotice } from '@/components/Global/CurrencyBalanceNotice'

jest.mock('@/utils/api-fetch', () => require('@/test-utils/balance-io').apiFetchModule)
jest.mock('@/utils/auth-token', () => ({
    ...jest.requireActual('@/utils/auth-token'),
    getAuthToken: () => 'test-token',
}))
jest.mock('@/app/actions/clients', () => require('@/test-utils/balance-io').clientsModule)
jest.mock('@/context/authContext', () => require('@/test-utils/balance-io').authModule)
jest.mock('@/hooks/useZeroDev', () => require('@/test-utils/balance-io').zeroDevModule)
jest.mock('@/hooks/wallet/useSendMoney', () => ({ useSendMoney: () => ({ mutateAsync: jest.fn() }) }))
jest.mock('@/hooks/wallet/useSpendBundle', () => ({ useSpendBundle: () => ({ spend: jest.fn() }) }))

let client: QueryClient
beforeEach(() => {
    resetIo()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
})
afterEach(() => {
    cleanup()
    client.clear()
    jest.useRealTimers()
    jest.restoreAllMocks()
})

const show = (currency: 'USDC' | 'EURC' = 'EURC', availableBalance?: bigint) =>
    render(
        <IntlWrapper>
            <QueryClientProvider client={client}>
                <CurrencyBalanceNotice currency={currency} amount="25" availableBalance={availableBalance} />
            </QueryClientProvider>
        </IntlWrapper>
    )

it('removes an estimate after a Rain refetch fails even though its previous balance stays cached', async () => {
    show()
    await screen.findByText(/Total across accounts/)
    io.rain.mockImplementation(() => fail())
    await act(async () => {
        await client.invalidateQueries({ queryKey: ['rain-card-overview', 'alice'] })
    })
    expect(await screen.findByText(en.currencyAccounts.convertedBalanceUnavailable)).toBeInTheDocument()
    expect(screen.queryByText(/Total across accounts/)).not.toBeInTheDocument()
})

it('removes an estimate after a smart-wallet refetch fails even though its previous balance stays cached', async () => {
    jest.useFakeTimers()
    show()
    await screen.findByText(/Total across accounts/)
    io.smartBalance.mockRejectedValue(new Error('RPC unavailable'))
    act(() => {
        void client.invalidateQueries({ queryKey: ['balance'] })
    })
    expect(
        await screen.findByText(en.currencyAccounts.convertedBalanceUnavailable, undefined, { timeout: 20_000 })
    ).toBeInTheDocument()
    expect(screen.queryByText(/Total across accounts/)).not.toBeInTheDocument()
})

it('values only available-now dollars when the caller excludes in-transit collateral', async () => {
    io.smartBalance.mockResolvedValue(0n)
    io.rain.mockImplementation(() => ok(rainOverview({ inTransitCents: 1000 })))
    show('USDC', 0n)
    expect(await screen.findByText('Total across accounts: ≈ 22.00 USD')).toBeInTheDocument()
})
