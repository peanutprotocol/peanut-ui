/**
 * The widget with the real hook: one authoritative quote per pair and amount
 * across a swap (TASK-21369), and the CTA carrying the on-screen amount
 * without waiting for the URL debounce (TASK-22294).
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import ExchangeRateWidget from '../index'
import { fetchDisplayRate, FxApiError } from '@/utils/fx.utils'
import {
    getExchangeRateWidgetRouteMinimum,
    type ExchangeRateWidgetMinimumPolicy,
} from '@/utils/exchangeRateWidget.utils'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} alt={props.alt} />,
}))

jest.mock('@/utils/fx.utils', () => {
    class MockFxApiError extends Error {
        constructor(readonly status: number) {
            super(`FX API returned ${status}`)
        }
    }
    return { fetchDisplayRate: jest.fn(), FxApiError: MockFxApiError }
})

const mockFetchDisplayRate = fetchDisplayRate as jest.Mock

type Deferred = { resolve: (rate: number) => void; promise: Promise<number> }
let pending: Record<string, Deferred>

const amountInputs = () => screen.queryAllByRole('spinbutton') as HTMLInputElement[]
const sourceInput = () => amountInputs()[0]
const destinationInput = () => amountInputs()[1]
/** The two currency triggers, in "You send" → "You get" order. */
const currencyPair = () =>
    screen
        .getAllByRole('button')
        .map((button) => button.textContent?.trim() ?? '')
        .filter((text) => /^(USD|EUR|BRL|ARS|GBP|MXN|COP)$/.test(text))

const renderWidget = ({
    onUrlUpdate = jest.fn(),
    to = 'EUR',
    amount = '10',
    minimumPolicy,
}: {
    onUrlUpdate?: jest.Mock
    to?: string
    amount?: string
    minimumPolicy?: ExchangeRateWidgetMinimumPolicy
} = {}) => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })
    const ctaAction = jest.fn()
    const tree = (searchParams: Record<string, string>) => (
        <QueryClientProvider client={client}>
            {/* hasMemory: without it the adapter's flush re-parses the INITIAL
                search params and silently undoes the swap */}
            <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
                <ExchangeRateWidget
                    ctaLabel="Withdraw now"
                    ctaIcon="arrow-down"
                    ctaAction={ctaAction}
                    restrictToRoutable
                    minimumPolicy={minimumPolicy}
                />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    const { rerender } = render(tree({ from: 'USD', to, amount }))
    // an external URL change (a popstate, a pasted link): the adapter re-syncs
    // its memory from new initial params, the widget sees the new pair + amount
    const setExternalUrl = (searchParams: Record<string, string>) => rerender(tree(searchParams))
    return { client, onUrlUpdate, ctaAction, setExternalUrl }
}

const cta = () => screen.getByRole('button', { name: /Withdraw now/ })
const swapButton = () => screen.getByRole('button', { name: 'Swap currencies' })
const urlAmounts = (onUrlUpdate: jest.Mock) =>
    onUrlUpdate.mock.calls.map((call) => (call[0].searchParams as URLSearchParams).get('amount'))
/** Open the source (0) or destination (1) selector and pick a currency. */
const pickCurrency = (side: 0 | 1, code: string) => {
    const triggers = screen
        .getAllByRole('button')
        .filter((b) => /^(USD|EUR|BRL|ARS|GBP|MXN|COP)$/.test(b.textContent?.trim() ?? ''))
    fireEvent.click(triggers[side])
    // the option's accessible name is "eu flag EUR Euro"
    fireEvent.click(screen.getByRole('option', { name: new RegExp(`\\b${code}\\b`) }))
}
const settleDebounce = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700))
    })

beforeEach(() => {
    pending = {}
    mockFetchDisplayRate.mockReset()
    mockFetchDisplayRate.mockImplementation((from: string, to: string) => {
        const key = `${from}/${to}`
        if (!pending[key]) {
            let resolve!: (rate: number) => void
            const promise = new Promise<number>((r) => (resolve = r))
            pending[key] = { resolve, promise }
        }
        return pending[key].promise
    })
})

describe('ExchangeRateWidget swap', () => {
    it('shows the skeleton until the reversed rate lands, then exactly one, correct quote', async () => {
        const { client } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await waitFor(() => expect(destinationInput().value).toBe('8.56'))

        fireEvent.click(screen.getByRole('button', { name: 'Swap currencies' }))

        // reversed pair, no rate yet: the fields are skeletons, not stale numbers
        expect(currencyPair()).toEqual(['EUR', 'USD'])
        expect(amountInputs()).toHaveLength(0)

        await act(async () => pending['EUR/USD'].resolve(1.168))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))

        // the very first quote rendered after the swap is the right one:
        // 8.56 EUR × 1.168 = 10.00 USD — never 10 × 1.168 = 11.68
        expect(sourceInput().value).toBe('8.56')
        expect(destinationInput().value).toBe('10.00')
        expect(screen.getByText(/1 EUR = 1\.1680 USD/)).toBeInTheDocument()
        client.clear()
    })

    it('keeps the swapped amount in the URL — the debounced old amount never writes over it', async () => {
        const { client, onUrlUpdate } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await waitFor(() => expect(destinationInput().value).toBe('8.56'))

        fireEvent.click(screen.getByRole('button', { name: 'Swap currencies' }))
        await act(async () => pending['EUR/USD'].resolve(1.168))
        await waitFor(() => expect(sourceInput().value).toBe('8.56'))

        // outlive the 500 ms debounce
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 700))
        })

        const amounts = urlAmounts(onUrlUpdate)
        expect(amounts.at(-1)).toBe('8.56')
        expect(amounts.slice(amounts.indexOf('8.56'))).toEqual(['8.56'])
        expect(sourceInput().value).toBe('8.56')
        expect(destinationInput().value).toBe('10.00')
        client.clear()
    })

    it('swapping back to a cached pair shows the right quote at once, with no skeleton', async () => {
        const { client } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await waitFor(() => expect(destinationInput().value).toBe('8.56'))
        fireEvent.click(screen.getByRole('button', { name: 'Swap currencies' }))
        await act(async () => pending['EUR/USD'].resolve(1.168))
        await waitFor(() => expect(sourceInput().value).toBe('8.56'))

        fireEvent.click(screen.getByRole('button', { name: 'Swap currencies' }))

        // synchronously after the tap: USD/EUR is cached, so no skeleton and
        // the quote is 10 USD (the net the user saw) × 0.8563
        expect(currencyPair()).toEqual(['USD', 'EUR'])
        expect(amountInputs()).toHaveLength(2)
        expect(sourceInput().value).toBe('10')
        expect(destinationInput().value).toBe('8.56')
        expect(mockFetchDisplayRate).toHaveBeenCalledTimes(2)
        client.clear()
    })
})

/**
 * The swap writes the net "You get" as the new amount. When that number equals
 * what the URL already held, the value alone cannot say "new amount" — the
 * widget's intent counter does (review finding, round 3).
 */
describe('ExchangeRateWidget swap whose amount equals the old URL amount', () => {
    it('type 20 at rate 0.5 and swap at once: quotes 10 EUR → 20 USD, not 20 EUR', async () => {
        const { client, onUrlUpdate } = renderWidget({ amount: '10' })
        await act(async () => pending['USD/EUR'].resolve(0.5))
        await waitFor(() => expect(destinationInput().value).toBe('5.00'))

        fireEvent.change(sourceInput(), { target: { value: '20' } })
        expect(destinationInput().value).toBe('10.00')
        fireEvent.click(screen.getByRole('button', { name: 'Swap currencies' }))
        await act(async () => pending['EUR/USD'].resolve(2))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))

        expect(currencyPair()).toEqual(['EUR', 'USD'])
        expect(sourceInput().value).toBe('10')
        expect(destinationInput().value).toBe('20.00')

        await settleDebounce()
        expect(sourceInput().value).toBe('10')
        // 10 is the parser default, which nuqs clears from the URL (null); the
        // old debounce never wrote 20 over it
        expect(urlAmounts(onUrlUpdate).filter((a) => a !== '10' && a !== null)).toEqual([])
        client.clear()
    })

    it('a second swap waits for the reversed rate: the first conversion stands, then swaps back to 10 USD', async () => {
        const { client } = renderWidget({ amount: '10' })
        await act(async () => pending['USD/EUR'].resolve(0.5))
        await waitFor(() => expect(destinationInput().value).toBe('5.00'))

        fireEvent.click(swapButton()) // EUR → USD, carries 5, reversed rate pending
        expect(currencyPair()).toEqual(['EUR', 'USD'])
        expect(swapButton()).toBeDisabled()
        fireEvent.click(swapButton()) // ignored: nothing usable to carry yet
        fireEvent.click(swapButton())
        expect(currencyPair()).toEqual(['EUR', 'USD'])
        expect(amountInputs()).toHaveLength(0)

        // the reversed rate lands: the FIRST requested conversion, 5 EUR → 10 USD
        await act(async () => pending['EUR/USD'].resolve(2))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))
        expect(sourceInput().value).toBe('5')
        expect(destinationInput().value).toBe('10.00')
        expect(swapButton()).toBeEnabled()

        // swapping back restores 10 USD → 5 EUR from the cached pair, at once
        fireEvent.click(swapButton())
        expect(currencyPair()).toEqual(['USD', 'EUR'])
        expect(sourceInput().value).toBe('10')
        expect(destinationInput().value).toBe('5.00')
        expect(mockFetchDisplayRate).toHaveBeenCalledTimes(2)
        client.clear()
    })

    it('with no usable quote the swap is disabled and a click changes nothing', async () => {
        // a 429 is terminal for the hook (no retries), so "unavailable" shows at once
        mockFetchDisplayRate.mockImplementation(() => Promise.reject(new (FxApiError as any)(429)))
        const { client } = renderWidget({ amount: '10' })
        await waitFor(() => expect(screen.getByText('Rate currently unavailable')).toBeInTheDocument())

        expect(swapButton()).toBeDisabled()
        fireEvent.click(swapButton())
        expect(currencyPair()).toEqual(['USD', 'EUR'])
        expect(sourceInput().value).toBe('10')
        client.clear()
    })
})

/**
 * A pair change the widget did not make — a popstate, a pasted link — carries
 * no intent, so the URL amount wins even when it equals the previous one.
 */
describe('ExchangeRateWidget external pair + amount change', () => {
    it('takes the URL amount when it differs from what is typed', async () => {
        const { client, setExternalUrl } = renderWidget({ amount: '10' })
        await act(async () => pending['USD/EUR'].resolve(0.5))
        await waitFor(() => expect(destinationInput().value).toBe('5.00'))
        fireEvent.change(sourceInput(), { target: { value: '20' } })

        setExternalUrl({ from: 'USD', to: 'BRL', amount: '100' })
        await act(async () => pending['USD/BRL'].resolve(5))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))

        expect(currencyPair()).toEqual(['USD', 'BRL'])
        expect(sourceInput().value).toBe('100')
        expect(destinationInput().value).toBe('500.00')
        client.clear()
    })

    it('takes the URL amount even when it equals the one the URL held before typing', async () => {
        const { client, setExternalUrl } = renderWidget({ amount: '10' })
        await act(async () => pending['USD/EUR'].resolve(0.5))
        await waitFor(() => expect(destinationInput().value).toBe('5.00'))
        fireEvent.change(sourceInput(), { target: { value: '20' } })

        setExternalUrl({ from: 'USD', to: 'BRL', amount: '10' })
        await act(async () => pending['USD/BRL'].resolve(5))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))

        expect(sourceInput().value).toBe('10')
        expect(destinationInput().value).toBe('50.00')
        client.clear()
    })
})

/**
 * A currency pick used to write only the pair; the hook then restarted from
 * the URL amount, which the debounce had not updated yet — 100 typed, 10 shown.
 * The pick now carries the amount on screen, and an empty field stays empty.
 */
describe('ExchangeRateWidget currency selectors under a pending debounce', () => {
    it('source selector: the just-typed amount survives the pick, and the old debounce never writes 10 back', async () => {
        const { client, onUrlUpdate } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await waitFor(() => expect(destinationInput().value).toBe('8.56'))

        fireEvent.change(sourceInput(), { target: { value: '100' } })
        pickCurrency(0, 'EUR') // source EUR forces the pair to EUR → USD
        await act(async () => pending['EUR/USD'].resolve(1.168))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))

        expect(currencyPair()).toEqual(['EUR', 'USD'])
        expect(sourceInput().value).toBe('100')
        expect(destinationInput().value).toBe('116.80')

        await settleDebounce()
        expect(urlAmounts(onUrlUpdate)).toEqual(['100'])
        expect(sourceInput().value).toBe('100')
        client.clear()
    })

    it('destination selector: same guarantee', async () => {
        const { client, onUrlUpdate } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await waitFor(() => expect(destinationInput().value).toBe('8.56'))

        fireEvent.change(sourceInput(), { target: { value: '100' } })
        pickCurrency(1, 'BRL')
        await act(async () => pending['USD/BRL'].resolve(5))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))

        expect(currencyPair()).toEqual(['USD', 'BRL'])
        expect(sourceInput().value).toBe('100')
        expect(destinationInput().value).toBe('500.00')
        await settleDebounce()
        expect(urlAmounts(onUrlUpdate)).toEqual(['100'])
        client.clear()
    })

    it('a "You get" edit carries its derived source through the pick', async () => {
        const { client } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8))
        await waitFor(() => expect(destinationInput().value).toBe('8.00'))

        fireEvent.change(destinationInput(), { target: { value: '100' } })
        expect(sourceInput().value).toBe('125')
        pickCurrency(1, 'BRL')
        await act(async () => pending['USD/BRL'].resolve(5))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))

        expect(sourceInput().value).toBe('125')
        expect(destinationInput().value).toBe('625.00')
        client.clear()
    })

    it('an empty field stays empty through the pick — no default 10 reappears', async () => {
        const { client, onUrlUpdate } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8))
        await waitFor(() => expect(destinationInput().value).toBe('8.00'))

        fireEvent.change(sourceInput(), { target: { value: '' } })
        pickCurrency(1, 'BRL')
        await act(async () => pending['USD/BRL'].resolve(5))
        await waitFor(() => expect(amountInputs()).toHaveLength(2))

        expect(sourceInput().value).toBe('')
        expect(destinationInput().value).toBe('')
        await settleDebounce()
        expect(urlAmounts(onUrlUpdate).filter((amount) => amount !== '10')).toEqual([])
        client.clear()
    })
})

/**
 * The gate judges what the forwarded source amount FUNDS, not the typed
 * "You get" figure (review finding). A destination edit derives its source
 * rounded up at token precision, so a requested 1 BRL is fundable.
 */
describe('ExchangeRateWidget BRL floor at 5.8 with the real hook', () => {
    const policy: ExchangeRateWidgetMinimumPolicy = {
        resolve: (rate) => getExchangeRateWidgetRouteMinimum('USD', 'BRL', 50, rate, null),
        label: (m) => `Minimum ${m.amount} ${m.currency}`,
    }
    const renderBrl = async () => {
        const rendered = renderWidget({ to: 'BRL', minimumPolicy: policy })
        await act(async () => pending['USD/BRL'].resolve(5.8))
        await waitFor(() => expect(destinationInput().value).toBe('58.00'))
        return rendered
    }

    it('typing 1 BRL derives a source that funds it (0.172414 USD) and the CTA carries that amount', async () => {
        const { client, ctaAction } = await renderBrl()
        fireEvent.change(destinationInput(), { target: { value: '1' } })

        expect(sourceInput().value).toBe('0.172414')
        expect(cta()).toBeEnabled()
        fireEvent.click(cta())
        expect(ctaAction).toHaveBeenCalledWith('USD', 'BRL', 0.172414)
        client.clear()
    })

    it('typing just below 1 BRL is refused, with the BRL floor named', async () => {
        const { client } = await renderBrl()
        fireEvent.change(destinationInput(), { target: { value: '0.99' } })

        expect(cta()).toBeDisabled()
        expect(screen.getByText('Minimum 1 BRL')).toBeInTheDocument()
        client.clear()
    })

    it('a typed source is judged by what it funds: 0.17 USD (0.986 BRL) fails, 0.18 USD passes', async () => {
        const { client } = await renderBrl()
        fireEvent.change(sourceInput(), { target: { value: '0.17' } })
        expect(cta()).toBeDisabled()

        fireEvent.change(sourceInput(), { target: { value: '0.18' } })
        expect(cta()).toBeEnabled()
        client.clear()
    })

    it('six-decimal boundary: a seventh decimal the payload cannot carry does not fund the floor', async () => {
        const { client } = await renderBrl()
        // 0.1724137 × 5.8 shows as "1.00", but the route carries 0.172413 → 0.99999 BRL
        fireEvent.change(sourceInput(), { target: { value: '0.1724137' } })

        expect(destinationInput().value).toBe('1.00')
        expect(cta()).toBeDisabled()
        expect(screen.getByText('Minimum 1 BRL')).toBeInTheDocument()
        client.clear()
    })
})

/**
 * A ready Bridge floor ($4 at Bridge 16.5) is independent of the indicative
 * display quote: when /fx/rate fails or is still pending, the floor still
 * gates the source amount (bridge-minimum closure review, P2).
 */
describe('ExchangeRateWidget Bridge floor without a display quote', () => {
    const bridgeFloor: ExchangeRateWidgetMinimumPolicy = {
        resolve: (rate) => getExchangeRateWidgetRouteMinimum('USD', 'MXN', 50, rate, 4),
        label: (m) => `Minimum ${m.amount} ${m.currency}`,
    }
    const displayFails = () =>
        mockFetchDisplayRate.mockImplementation(() => Promise.reject(new (FxApiError as any)(429)))

    it('display failed, 3 USD: disabled with the $4 minimum; the pill stays honest', async () => {
        displayFails()
        const { client, ctaAction } = renderWidget({ to: 'MXN', amount: '3', minimumPolicy: bridgeFloor })
        await waitFor(() =>
            expect(screen.getByTestId('exchange-rate-pill')).toHaveTextContent('Rate currently unavailable')
        )

        expect(cta()).toBeDisabled()
        expect(screen.getByTestId('exchange-rate-minimum')).toHaveTextContent('Minimum 4 USD')
        fireEvent.click(cta())
        expect(ctaAction).not.toHaveBeenCalled()
        client.clear()
    })

    it('display failed, exactly 4 USD: enabled and forwards 4', async () => {
        displayFails()
        const { client, ctaAction } = renderWidget({ to: 'MXN', amount: '4', minimumPolicy: bridgeFloor })
        await waitFor(() =>
            expect(screen.getByTestId('exchange-rate-pill')).toHaveTextContent('Rate currently unavailable')
        )

        expect(cta()).toBeEnabled()
        expect(screen.queryByTestId('exchange-rate-minimum')).not.toBeInTheDocument()
        fireEvent.click(cta())
        expect(ctaAction).toHaveBeenCalledWith('USD', 'MXN', 4)
        client.clear()
    })

    it('display pending, 3 USD: disabled with the $4 minimum before any quote arrives', () => {
        const { client, ctaAction } = renderWidget({ to: 'MXN', amount: '3', minimumPolicy: bridgeFloor })

        expect(amountInputs()).toHaveLength(0) // still loading the display quote
        expect(cta()).toBeDisabled()
        expect(screen.getByTestId('exchange-rate-minimum')).toHaveTextContent('Minimum 4 USD')
        fireEvent.click(cta())
        expect(ctaAction).not.toHaveBeenCalled()
        client.clear()
    })

    it('display pending, exactly 4 USD: enabled and forwards 4', () => {
        const { client, ctaAction } = renderWidget({ to: 'MXN', amount: '4', minimumPolicy: bridgeFloor })

        expect(amountInputs()).toHaveLength(0)
        expect(cta()).toBeEnabled()
        fireEvent.click(cta())
        expect(ctaAction).toHaveBeenCalledWith('USD', 'MXN', 4)
        client.clear()
    })

    it('display pending but the Bridge rate itself failed: still blocked, no floor shown', () => {
        const { client, ctaAction } = renderWidget({
            to: 'MXN',
            amount: '4',
            minimumPolicy: {
                ...bridgeFloor,
                resolve: (rate) => getExchangeRateWidgetRouteMinimum('USD', 'MXN', 50, rate, null),
                blocked: 'unavailable',
            },
        })

        expect(cta()).toBeDisabled()
        expect(screen.queryByTestId('exchange-rate-minimum')).not.toBeInTheDocument()
        fireEvent.click(cta())
        expect(ctaAction).not.toHaveBeenCalled()
        client.clear()
    })
})

describe('ExchangeRateWidget CTA amount', () => {
    it('hands the CTA the amount just typed, before the URL debounce has written it', async () => {
        const { client, ctaAction, onUrlUpdate } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8563))
        await waitFor(() => expect(destinationInput().value).toBe('8.56'))

        fireEvent.change(sourceInput(), { target: { value: '100' } })
        fireEvent.click(screen.getByRole('button', { name: /Withdraw now/ }))

        expect(ctaAction).toHaveBeenCalledWith('USD', 'EUR', 100)
        // the URL still says 10 at this point — it is not the source of truth
        expect(onUrlUpdate).not.toHaveBeenCalled()
        client.clear()
    })

    it('hands the CTA the source derived from a "You get" edit', async () => {
        const { client, ctaAction } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8))
        await waitFor(() => expect(destinationInput().value).toBe('8.00'))

        fireEvent.change(destinationInput(), { target: { value: '100' } })
        expect(sourceInput().value).toBe('125')
        fireEvent.click(screen.getByRole('button', { name: /Withdraw now/ }))

        expect(ctaAction).toHaveBeenCalledWith('USD', 'EUR', 125)
        client.clear()
    })

    it('hands the CTA null while the field is empty', async () => {
        const { client, ctaAction } = renderWidget()
        await act(async () => pending['USD/EUR'].resolve(0.8))
        await waitFor(() => expect(destinationInput().value).toBe('8.00'))

        fireEvent.change(sourceInput(), { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: /Withdraw now/ }))

        expect(ctaAction).toHaveBeenCalledWith('USD', 'EUR', null)
        client.clear()
    })
})
