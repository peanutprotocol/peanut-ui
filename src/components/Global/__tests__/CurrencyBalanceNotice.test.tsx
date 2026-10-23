import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import {
    EURC_ASSET_ROW,
    USDC_ACCOUNT,
    fail,
    io,
    never,
    ok,
    pricingRequests,
    rainOverview,
    rateBody,
    resetIo,
    units,
} from '@/test-utils/balance-io'
import { writeLastKnownSpendable } from '@/hooks/wallet/lastKnownSpendable'
import { CurrencyBalanceNotice } from '../CurrencyBalanceNotice'

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

// `availableBalance` is the caller's available-now dollars (smart account +
// landed collateral, no in-transit), required by U4.
type NoticeProps = React.ComponentProps<typeof CurrencyBalanceNotice> & { availableBalance?: bigint }
const Notice = CurrencyBalanceNotice as unknown as React.ComponentType<NoticeProps>

const copy = en.currencyAccounts
const totalLine = (amount: string, currency: 'USD' | 'EUR') =>
    copy.convertedTotalBalance.replace('{amount}', amount).replace('{currency}', currency)
const ANY_TOTAL = /Total across accounts/

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

const show = (props: NoticeProps) =>
    render(
        <IntlWrapper>
            <QueryClientProvider client={client}>
                <Notice {...props} />
            </QueryClientProvider>
        </IntlWrapper>
    )
const showEuroSend = (amount: string) => show({ currency: 'EURC', amount, showSelectedBalance: true })
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 50)))

describe('converted totals', () => {
    it('shows converted euros below the dollar balance only on a dollar shortfall', async () => {
        show({ currency: 'USDC', amount: '50' })
        expect(await screen.findByText(totalLine('32.00', 'USD'))).toBeInTheDocument()
        expect(screen.getByText(copy.convertedBalanceWarning)).toBeInTheDocument()
        expect(pricingRequests().length).toBeGreaterThan(0)
        expect(pricingRequests().every((request) => request.includes('from=EURC'))).toBe(true)
    })

    it('uses the opposite quote for euro sends and preserves the selected token balance', async () => {
        showEuroSend('25')
        expect(await screen.findByText('Balance: 20 EUR')).toBeInTheDocument()
        expect(await screen.findByText(totalLine('29.00', 'EUR'))).toBeInTheDocument()
        expect(pricingRequests().every((request) => request.includes('from=USDC'))).toBe(true)
    })

    it.each(['5', '10', '', '0', '1e3'])(
        'requests no price when the amount %s has no valid shortfall',
        async (amount) => {
            show({ currency: 'USDC', amount })
            await waitFor(() => expect(io.baseRead).toHaveBeenCalled())
            await settle()
            expect(pricingRequests()).toEqual([])
            expect(screen.queryByText(ANY_TOTAL)).not.toBeInTheDocument()
        }
    )

    it('never adds an unreadable euro balance', async () => {
        io.baseRead.mockRejectedValue(new Error('RPC unavailable'))
        show({ currency: 'USDC', amount: '50' })
        expect(await screen.findByText(copy.convertedBalanceUnavailable)).toBeInTheDocument()
        expect(pricingRequests()).toEqual([])
        expect(screen.queryByText(ANY_TOTAL)).not.toBeInTheDocument()
    })

    it('removes a shown total when a refreshed rate fails', async () => {
        show({ currency: 'USDC', amount: '50' })
        await screen.findByText(totalLine('32.00', 'USD'))
        io.rate.mockImplementation(() => fail())
        await act(async () => {
            await client.invalidateQueries({ predicate: (query) => JSON.stringify(query.queryKey).includes('rate') })
        })
        expect(await screen.findByText(copy.convertedBalanceUnavailable)).toBeInTheDocument()
        expect(screen.queryByText(/32\.00 USD/)).not.toBeInTheDocument()
    })

    it('keeps calculating, with no price request, while the dollar balance is still loading', async () => {
        io.rain.mockImplementation(never)
        showEuroSend('25')
        await screen.findByText('Balance: 20 EUR')
        await settle()
        expect(screen.getByText(copy.convertedBalanceLoading)).toBeInTheDocument()
        expect(pricingRequests()).toEqual([])
    })

    it('loads no balances for a signed-out visitor', async () => {
        io.userId = null
        show({ currency: 'USDC', amount: '50' })
        await settle()
        expect(io.requests).toEqual([])
        expect(io.smartBalance).not.toHaveBeenCalled()
        expect(io.baseRead).not.toHaveBeenCalled()
    })

    it('makes no Base balance or pricing request for a USD-only user on a dollar shortfall', async () => {
        io.accounts.mockImplementation(() => ok({ accounts: [USDC_ACCOUNT], available: [EURC_ASSET_ROW] }))
        show({ currency: 'USDC', amount: '50' })
        await waitFor(() => expect(io.accounts).toHaveBeenCalled())
        await waitFor(() => expect(io.rain).toHaveBeenCalled())
        await settle()
        expect(io.baseRead).not.toHaveBeenCalled()
        expect(pricingRequests()).toEqual([])
        expect(screen.queryByText(ANY_TOTAL)).not.toBeInTheDocument()
        expect(screen.queryByText(copy.convertedBalanceUnavailable)).not.toBeInTheDocument()
        expect(screen.queryByText(copy.convertedBalanceLoading)).not.toBeInTheDocument()
    })
})

describe('U1: dollars that are cached or flagged unavailable are never valued as live', () => {
    beforeEach(() => {
        io.smartBalance.mockResolvedValue(0n)
    })

    it('shows the euro estimate as unavailable, not ≈ 470 EUR, when Rain fails and $500 is cached', async () => {
        writeLastKnownSpendable('alice', units(500))
        io.rain.mockImplementation(() => fail())
        showEuroSend('25')
        await screen.findByText('Balance: 20 EUR')
        expect(await screen.findByText(copy.convertedBalanceUnavailable)).toBeInTheDocument()
        expect(screen.queryByText(ANY_TOTAL)).not.toBeInTheDocument()
    })

    it('shows the euro estimate as unavailable when Rain answers balanceUnavailable with no balance and $500 is cached', async () => {
        writeLastKnownSpendable('alice', units(500))
        io.rain.mockImplementation(() => ok(rainOverview({ withBalance: false, balanceUnavailable: true })))
        showEuroSend('25')
        await screen.findByText('Balance: 20 EUR')
        expect(await screen.findByText(copy.convertedBalanceUnavailable)).toBeInTheDocument()
        expect(screen.queryByText(ANY_TOTAL)).not.toBeInTheDocument()
    })

    it('shows the euro estimate as unavailable when Rain serves a stale $500 flagged balanceUnavailable', async () => {
        io.rain.mockImplementation(() => ok(rainOverview({ spendingPowerCents: 50_000, balanceUnavailable: true })))
        showEuroSend('25')
        await screen.findByText('Balance: 20 EUR')
        expect(await screen.findByText(copy.convertedBalanceUnavailable)).toBeInTheDocument()
        expect(screen.queryByText(ANY_TOTAL)).not.toBeInTheDocument()
    })

    it('shows no dollar total on a dollar send whose balance is only a cached $500', async () => {
        writeLastKnownSpendable('alice', units(500))
        io.rain.mockImplementation(() => fail())
        show({ currency: 'USDC', amount: '600' })
        await waitFor(() => expect(io.baseRead).toHaveBeenCalled())
        await waitFor(() => expect(io.rain).toHaveBeenCalled())
        await settle()
        expect(screen.queryByText(ANY_TOTAL)).not.toBeInTheDocument()
        expect(screen.queryByText(copy.convertedBalanceWarning)).not.toBeInTheDocument()
    })
})

describe('U2: estimates use the directional sell rate', () => {
    it('values dollars at the USD→EUR sell rate (92.96 EUR, not the midmarket 93.42)', async () => {
        io.smartBalance.mockResolvedValue(units(100))
        io.baseRead.mockResolvedValue(0n)
        io.rate.mockImplementation(() => ok(rateBody({ midmarket: '0.9342', sell: '0.9296', buy: '0.9388' })))
        showEuroSend('5')
        expect(await screen.findByText(totalLine('92.96', 'EUR'))).toBeInTheDocument()
        expect(screen.queryByText(totalLine('93.42', 'EUR'))).not.toBeInTheDocument()
    })

    it('values euros at the EUR→USD sell rate (106.50 USD, not the midmarket 107.04)', async () => {
        io.smartBalance.mockResolvedValue(0n)
        io.baseRead.mockResolvedValue(units(100))
        io.rate.mockImplementation(() => ok(rateBody({ midmarket: '1.0704', sell: '1.0650', buy: '1.0758' })))
        show({ currency: 'USDC', amount: '5' })
        expect(await screen.findByText(totalLine('106.50', 'USD'))).toBeInTheDocument()
        expect(screen.queryByText(totalLine('107.04', 'USD'))).not.toBeInTheDocument()
    })

    it('truncates the sell-rate valuation so rounding never overstates (9.30 EUR, not 9.31)', async () => {
        io.smartBalance.mockResolvedValue(units(10.01))
        io.baseRead.mockResolvedValue(0n)
        io.rate.mockImplementation(() => ok(rateBody({ midmarket: '0.9342', sell: '0.9296', buy: '0.9388' })))
        showEuroSend('5')
        expect(await screen.findByText(totalLine('9.30', 'EUR'))).toBeInTheDocument()
        expect(screen.queryByText(totalLine('9.31', 'EUR'))).not.toBeInTheDocument()
    })

    it.each([
        ['missing', undefined],
        ['NaN', 'NaN'],
        ['zero', '0'],
    ])('shows the estimate as unavailable instead of using midmarket when sell_rate is %s', async (_, sell) => {
        io.smartBalance.mockResolvedValue(units(100))
        io.baseRead.mockResolvedValue(0n)
        io.rate.mockImplementation(() => ok(rateBody({ midmarket: '0.9342', sell, buy: '0.9388' })))
        showEuroSend('5')
        expect(await screen.findByText(copy.convertedBalanceUnavailable)).toBeInTheDocument()
        expect(screen.queryByText(ANY_TOTAL)).not.toBeInTheDocument()
    })
})

describe('U3: failed dollar reads with nothing cached', () => {
    it('offers Retry instead of calculating forever when Rain fails, and Retry reloads both dollar sources', async () => {
        io.smartBalance.mockResolvedValueOnce(units(1)).mockResolvedValue(units(7))
        io.rain.mockImplementation(() => fail())
        showEuroSend('25')
        await screen.findByText('Balance: 20 EUR')
        expect(await screen.findByText(copy.convertedBalanceUnavailable)).toBeInTheDocument()
        expect(screen.queryByText(copy.convertedBalanceLoading)).not.toBeInTheDocument()

        io.rain.mockImplementation(() => ok(rainOverview({ spendingPowerCents: 300 })))
        fireEvent.click(screen.getByRole('button', { name: copy.retry }))

        // 20 EURC + ($7 smart, re-read + $3 Rain) × 0.9 — a stale $1 smart read would give 23.60.
        expect(await screen.findByText(totalLine('29.00', 'EUR'))).toBeInTheDocument()
        expect(screen.queryByText(copy.convertedBalanceUnavailable)).not.toBeInTheDocument()
    })

    it('offers Retry when the smart-account read and Rain both fail, and recovers once both answer', async () => {
        jest.useFakeTimers()
        io.smartBalance.mockRejectedValue(new Error('RPC unavailable'))
        io.rain.mockImplementation(() => fail())
        showEuroSend('25')
        expect(
            await screen.findByText(copy.convertedBalanceUnavailable, undefined, { timeout: 20_000 })
        ).toBeInTheDocument()

        io.smartBalance.mockResolvedValue(units(7))
        io.rain.mockImplementation(() => ok(rainOverview({ spendingPowerCents: 300 })))
        fireEvent.click(screen.getByRole('button', { name: copy.retry }))

        expect(await screen.findByText(totalLine('29.00', 'EUR'), undefined, { timeout: 5_000 })).toBeInTheDocument()
    })
})

describe('U4: the caller’s available-now balance decides the shortfall', () => {
    it('shows exchange guidance when available-now dollars fall short though in-transit funds cover the display', async () => {
        // Displayed $10 is all in transit to card collateral; nothing is spendable this instant.
        io.smartBalance.mockResolvedValue(0n)
        io.rain.mockImplementation(() => ok(rainOverview({ spendingPowerCents: 0, inTransitCents: 1_000 })))
        show({ currency: 'USDC', amount: '5', availableBalance: 0n })
        expect(await screen.findByText(copy.convertedBalanceWarning)).toBeInTheDocument()
        expect(screen.getByText(ANY_TOTAL)).toBeInTheDocument()
    })
})
