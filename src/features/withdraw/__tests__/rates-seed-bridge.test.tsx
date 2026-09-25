/**
 * Chip review 5310927574: the Rates & fees CTA opens /withdraw?currencyCode=MXN
 * &amount=10 with a USD amount. A saved CLABE is typed in MXN (TASK-23054), and
 * the step opened blank — the MXN field had no value, and reporting that
 * blank cleared the USD seed. A new Bridge destination lost the amount on the
 * way to its form.
 *
 * The seed now opens the field in USD (the input's own toggle), and the live
 * Bridge quote derives the MXN amount the review quotes. Runs the real flow
 * provider, method view, root flow, quote hook, Bridge minimum and AmountInput;
 * only the server actions, wallet and list chrome are stubbed.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import { IntlWrapper } from '@/test-utils/intl'

const mockRouterPush = jest.fn()
// the send-origin hook reads the entry params through next/navigation
let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/withdraw',
    useSearchParams: () => mockSearchParams,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), init: jest.fn() } }))

// the quote the MXN field converts with (Bridge rate, fees included)
const mockGetOfframpQuote = jest.fn()
jest.mock('@/app/actions/offramp', () => ({
    getOfframpQuote: (...args: unknown[]) => mockGetOfframpQuote(...args),
}))
// the Bridge sell rate behind the MX minimum (50 MXN)
jest.mock('@/hooks/useGetExchangeRate', () => ({
    __esModule: true,
    default: () => ({ exchangeRate: '17', isError: false }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ spendableBalance: parseUnits('100', 6), formattedSpendableBalance: '100.00' }),
}))
jest.mock('@/features/limits/hooks/useLimitsValidation', () => ({
    useLimitsValidation: () => ({ isBlocking: false, isWarning: false, isLoading: false }),
}))

const CLABE = { type: 'clabe', identifier: '646180111800000000', details: { countryName: 'mexico' } }
const IBAN = { type: 'iban', identifier: 'DE89370400440532013000', details: { countryName: 'germany' } }
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { accounts: [CLABE, IBAN] } }) }))
jest.mock('@/hooks/useSavedAddresses', () => ({
    useSavedAddresses: () => ({ savedAddresses: [], isLoading: false, rename: {}, remove: {} }),
}))
jest.mock('@/features/destinations/useRenameAccount', () => ({ useRenameAccount: () => jest.fn() }))
jest.mock('@/features/destinations/DestinationEditDrawer', () => ({ __esModule: true, default: () => null }))
// Mexico is pinned to its one bank rail; every other country reads the real
// catalogue, unless a case turns on Brazil's second rail (Manteca bank transfer)
let mockBrazilHasTwoRails = false
jest.mock('@/features/destinations/country-rails', () => {
    const actual = jest.requireActual('@/features/destinations/country-rails')
    return {
        ...actual,
        soleLiveRailForCountry: (id: string, flow: string) => {
            if (id === 'MX') return { id: 'mx-default-bank-withdraw', title: 'To Bank' }
            if (id === 'BR' && mockBrazilHasTwoRails) return null
            return actual.soleLiveRailForCountry(id, flow)
        },
    }
})
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))
// The two lists' own behaviour has its own suites; here they hand over the
// same account and country the real ones do.
jest.mock('@/components/Common/SavedAccountsView', () => ({
    __esModule: true,
    default: (props: { onAccountClick: (account: unknown, path: string) => void }) => (
        <>
            <button onClick={() => props.onAccountClick(CLABE, '/withdraw/mexico/bank')}>Saved CLABE</button>
            <button onClick={() => props.onAccountClick(IBAN, '/withdraw/germany/bank')}>Saved IBAN</button>
        </>
    ),
}))
jest.mock('@/features/withdraw/components/WithdrawCurrencyList', () => ({
    WithdrawCurrencyList: (props: { onCountryClick: (country: unknown) => void }) => (
        <>
            <button
                onClick={() => props.onCountryClick({ id: 'MX', path: 'mexico', currency: 'MXN', title: 'Mexico' })}
            >
                Mexico
            </button>
            <button
                onClick={() => props.onCountryClick({ id: 'BR', path: 'brazil', currency: 'BRL', title: 'Brazil' })}
            >
                Brazil
            </button>
        </>
    ),
}))

import { WithdrawFlowProvider } from '../WithdrawFlowContext'
import WithdrawRoot from '../WithdrawRoot'

// Browser Back from the review lands on the amount step again: the /withdraw
// layout (flow provider, URL, quote cache) stays, the page remounts.
function RemountableRoot() {
    const [mount, setMount] = React.useState(0)
    return (
        <>
            <button onClick={() => setMount((n) => n + 1)}>remount page</button>
            <WithdrawRoot key={mount} />
        </>
    )
}

let queryClient: QueryClient
const mockUrlUpdate = jest.fn()
function renderFromRatesCta(params: Record<string, string>) {
    mockSearchParams = new URLSearchParams(params)
    queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })
    render(
        <NuqsTestingAdapter searchParams={params} hasMemory onUrlUpdate={mockUrlUpdate}>
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>
                    <WithdrawFlowProvider>
                        <RemountableRoot />
                    </WithdrawFlowProvider>
                </QueryClientProvider>
            </IntlWrapper>
        </NuqsTestingAdapter>
    )
}
const currentUrl = () => mockUrlUpdate.mock.calls.at(-1)?.[0].searchParams as URLSearchParams | undefined
const backToAmountStep = () => fireEvent.click(screen.getByText('remount page'))

const field = () => screen.getByRole('textbox') as HTMLInputElement
const continueButton = () => screen.getByRole('button', { name: 'Continue' })
const lastPush = () => new URL(mockRouterPush.mock.calls.at(-1)?.[0], 'https://peanut.test')
const setLiveRate = (rate: string) =>
    act(() => {
        queryClient.setQueryData(['bridgeOfframpQuote', 'mxn', null], { rate })
    })

beforeEach(() => {
    jest.clearAllMocks()
    mockGetOfframpQuote.mockResolvedValue({ data: { rate: '17' } })
})

describe('Rates & fees USD amount → a saved CLABE (MXN amount step)', () => {
    it('opens on the USD seed, derives the MXN at the live quote and hands it to the review', async () => {
        renderFromRatesCta({ currencyCode: 'MXN', amount: '10' })
        fireEvent.click(screen.getByText('Saved CLABE'))

        await waitFor(() => expect(field().value).toBe('10'))
        expect(screen.getByText('USD')).toBeInTheDocument()
        expect(screen.getByText(/≈ MXN 170/)).toBeInTheDocument()

        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(lastPush().pathname).toContain('mexico')
        expect(lastPush().searchParams.get('destinationAmount')).toBe('170')
        expect(lastPush().searchParams.get('amount')).toBeNull()
    })

    it('waits for a delayed quote, then opens on the same seed', async () => {
        let resolveQuote!: (value: { data: { rate: string } }) => void
        mockGetOfframpQuote.mockReturnValueOnce(new Promise((resolve) => (resolveQuote = resolve)))
        renderFromRatesCta({ currencyCode: 'MXN', amount: '10' })
        fireEvent.click(screen.getByText('Saved CLABE'))

        expect(await screen.findByTestId('loading')).toBeInTheDocument()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

        await act(async () => resolveQuote({ data: { rate: '17' } }))
        await waitFor(() => expect(field().value).toBe('10'))
    })

    it('keeps the typed USD when the quote refreshes; only the MXN moves', async () => {
        renderFromRatesCta({ currencyCode: 'MXN', amount: '10' })
        fireEvent.click(screen.getByText('Saved CLABE'))
        await waitFor(() => expect(field().value).toBe('10'))

        fireEvent.change(field(), { target: { value: '20' } })
        setLiveRate('18')

        // query observers hear the new rate on a macrotask
        await waitFor(() => expect(screen.getByText(/≈ MXN 360/)).toBeInTheDocument())
        expect(field().value).toBe('20')
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(lastPush().searchParams.get('destinationAmount')).toBe('360')
    })

    it('below the MX minimum ($3 at Bridge 17): Continue stays disabled and says why', async () => {
        renderFromRatesCta({ currencyCode: 'MXN', amount: '2' })
        fireEvent.click(screen.getByText('Saved CLABE'))
        await waitFor(() => expect(field().value).toBe('2'))

        expect(await screen.findByText('Minimum withdrawal is $3.')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        // the message stays: later renders of the field must not clear it
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 400))
        })
        expect(screen.getByText('Minimum withdrawal is $3.')).toBeInTheDocument()
    })

    it('fails closed when the quote is unavailable, and the seed survives the retry', async () => {
        mockGetOfframpQuote.mockResolvedValue({ error: 'unavailable' })
        renderFromRatesCta({ currencyCode: 'MXN', amount: '10' })
        fireEvent.click(screen.getByText('Saved CLABE'))

        // the hook retries twice before it gives up
        const retry = await screen.findByRole('button', { name: /retry|try again/i }, { timeout: 8000 })
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()

        mockGetOfframpQuote.mockResolvedValue({ data: { rate: '17' } })
        fireEvent.click(retry)
        await waitFor(() => expect(field().value).toBe('10'))
    }, 15_000)
})

/*
 * Chip 5311722761: Rates amount 10 → saved EUR account → switch the field to
 * EUR → type 20 → Continue → Back. The USD seed stayed in the URL, so the
 * remounted step opened on the converted USD and a new quote re-derived the
 * EUR — replacing the 20 the user typed. The unit the user picked now stays.
 */
describe('Rates & fees USD amount → a saved EUR account, then Back from the review', () => {
    const setEurRate = (rate: string) =>
        act(() => {
            queryClient.setQueryData(['bridgeOfframpQuote', 'eur', null], { rate })
        })
    const openSavedIban = async () => {
        mockGetOfframpQuote.mockResolvedValue({ data: { rate: '0.9' } })
        renderFromRatesCta({ currencyCode: 'EUR', amount: '10' })
        fireEvent.click(screen.getByText('Saved IBAN'))
        await waitFor(() => expect(field().value).toBe('10'))
        expect(screen.getByText('USD')).toBeInTheDocument()
    }

    it('a bank amount typed in EUR stays 20 EUR after Back and a new quote', async () => {
        await openSavedIban()

        fireEvent.click(screen.getByRole('button', { name: 'Switch currency' }))
        await waitFor(() => expect(screen.getByText('EUR')).toBeInTheDocument())
        // the USD seed leaves the URL with the switch
        await waitFor(() => expect(currentUrl()?.get('amount')).toBeNull())
        fireEvent.change(field(), { target: { value: '20' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(lastPush().searchParams.get('destinationAmount')).toBe('20')

        backToAmountStep()
        await waitFor(() => expect(field().value).toBe('20'))
        expect(screen.getByText('EUR')).toBeInTheDocument()

        setEurRate('0.95')
        // the new rate moves the USD under it, never the EUR the user typed
        await waitFor(() => expect(screen.getByText(/≈ USD 21\.05/)).toBeInTheDocument())
        expect(field().value).toBe('20')
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(lastPush().searchParams.get('destinationAmount')).toBe('20')
    })

    it('a USD amount the user kept stays USD after Back; the new quote moves the EUR', async () => {
        await openSavedIban()

        fireEvent.change(field(), { target: { value: '12' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(lastPush().searchParams.get('destinationAmount')).toBe('10.8')

        backToAmountStep()
        await waitFor(() => expect(field().value).toBe('12'))
        expect(screen.getByText('USD')).toBeInTheDocument()

        setEurRate('1')
        await waitFor(() => expect(screen.getByText(/≈ EUR 12/)).toBeInTheDocument())
        expect(field().value).toBe('12')
    })

    it('switching to EUR and back to USD keeps USD as the unit for Back', async () => {
        await openSavedIban()

        const toggle = () => fireEvent.click(screen.getByRole('button', { name: 'Switch currency' }))
        toggle()
        await waitFor(() => expect(screen.getByText('EUR')).toBeInTheDocument())
        toggle()
        await waitFor(() => expect(screen.getByText('USD')).toBeInTheDocument())
        await waitFor(() => expect(currentUrl()?.get('amount')).toBe(field().value))

        backToAmountStep()
        await waitFor(() => expect(screen.getByText('USD')).toBeInTheDocument())
    })
})

describe('Rates & fees USD amount → a new Bridge destination', () => {
    it('the bank form receives the amount, which it hands to the amount step once saved', () => {
        renderFromRatesCta({ currencyCode: 'MXN', amount: '10', showAll: 'true' })
        fireEvent.click(screen.getByText('Mexico'))

        expect(lastPush().pathname).toContain('mexico')
        expect(lastPush().searchParams.get('step')).toBe('form')
        expect(lastPush().searchParams.get('amount')).toBe('10')
    })

    it('from Send → Bank the send origin rides along with it', () => {
        renderFromRatesCta({ amount: '10', showAll: 'true', method: 'bank' })
        fireEvent.click(screen.getByText('Mexico'))

        expect(lastPush().searchParams.get('method')).toBe('bank')
        expect(lastPush().searchParams.get('amount')).toBe('10')
    })
})

/**
 * Chip 5311215266: USD → BRL 5, then a new Brazil destination. Today's
 * catalogue leaves Brazil one live rail (Pix; its bank transfer is not live),
 * so the pick goes straight to PIX with the amount. With both rails live the
 * pick opens the rail list — that hop dropped the amount, and PIX then opened
 * with no seed. The list forwards it to the picked rail (its own suite).
 */
describe('Rates & fees USD amount → a new Brazil destination', () => {
    afterEach(() => {
        mockBrazilHasTwoRails = false
    })

    it('one live rail (the catalogue today): straight to PIX with the amount', () => {
        renderFromRatesCta({ currencyCode: 'BRL', amount: '5', showAll: 'true' })
        fireEvent.click(screen.getByText('Brazil'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/manteca?method=pix&country=brazil&amount=5')
    })

    it('two live rails: the rail list gets the amount, named so it is not read as an old bank-form link', () => {
        mockBrazilHasTwoRails = true
        renderFromRatesCta({ currencyCode: 'BRL', amount: '5', showAll: 'true' })
        fireEvent.click(screen.getByText('Brazil'))

        expect(lastPush().pathname).toBe('/withdraw/brazil')
        expect(lastPush().searchParams.get('step')).toBe('list')
        expect(lastPush().searchParams.get('amount')).toBe('5')
    })

    it('two live rails from Send → Bank: the send origin rides along to the rail list', () => {
        mockBrazilHasTwoRails = true
        renderFromRatesCta({ amount: '5', showAll: 'true', method: 'bank' })
        fireEvent.click(screen.getByText('Brazil'))

        expect(lastPush().pathname).toBe('/withdraw/brazil')
        expect(lastPush().searchParams.get('method')).toBe('bank')
        expect(lastPush().searchParams.get('amount')).toBe('5')
    })

    it('no amount: the rail list URL stays plain', () => {
        mockBrazilHasTwoRails = true
        renderFromRatesCta({ showAll: 'true' })
        fireEvent.click(screen.getByText('Brazil'))

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/brazil')
    })
})
