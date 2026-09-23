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
import { fetchDisplayRate } from '@/utils/fx.utils'

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
        .map((button) => button.textContent?.trim())
        .filter((text) => text === 'USD' || text === 'EUR')

const renderWidget = (onUrlUpdate = jest.fn()) => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })
    const ctaAction = jest.fn()
    render(
        <QueryClientProvider client={client}>
            {/* hasMemory: without it the adapter's flush re-parses the INITIAL
                search params and silently undoes the swap */}
            <NuqsTestingAdapter
                searchParams={{ from: 'USD', to: 'EUR', amount: '10' }}
                onUrlUpdate={onUrlUpdate}
                hasMemory
            >
                <ExchangeRateWidget
                    ctaLabel="Withdraw now"
                    ctaIcon="arrow-down"
                    ctaAction={ctaAction}
                    restrictToRoutable
                />
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    return { client, onUrlUpdate, ctaAction }
}

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

        const amounts = onUrlUpdate.mock.calls.map((call) => (call[0].searchParams as URLSearchParams).get('amount'))
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
