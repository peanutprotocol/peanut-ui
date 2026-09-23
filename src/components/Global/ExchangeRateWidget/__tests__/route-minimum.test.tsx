/**
 * The route's floor gates the CTA in the unit that route states it: a USD
 * floor against "You send" at payload precision, a BRL floor against the cents
 * "You get" shows (TASK-22235, TASK-22297).
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import ExchangeRateWidget from '../index'
import type { ExchangeRateWidgetMinimumPolicy, RouteMinimum } from '@/utils/exchangeRateWidget.utils'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => <img {...props} alt={props.alt} />,
}))

const mockUseExchangeRate = jest.fn()
jest.mock('@/hooks/useExchangeRate', () => ({
    useExchangeRate: (...args: unknown[]) => mockUseExchangeRate(...args),
}))

const quote = (sourceAmount: number | '', exchangeRate: number, over: Record<string, unknown> = {}) => ({
    sourceAmount,
    destinationAmount: typeof sourceAmount === 'number' ? sourceAmount * exchangeRate : '',
    exchangeRate,
    isLoading: false,
    isError: false,
    handleSourceAmountChange: jest.fn(),
    handleDestinationAmountChange: jest.fn(),
    getDestinationDisplayValue: () => '',
    ...over,
})

const policyFor = (minimum: RouteMinimum | null): ExchangeRateWidgetMinimumPolicy => ({
    resolve: jest.fn(() => minimum),
    label: (m) => `Minimum ${m.amount} ${m.currency}`,
})

const ctaAction = jest.fn()
const renderWidget = (to: string, minimumPolicy?: ExchangeRateWidgetMinimumPolicy) =>
    render(
        <NuqsTestingAdapter searchParams={{ from: 'USD', to, amount: '10' }}>
            <ExchangeRateWidget
                ctaLabel="Withdraw now"
                ctaIcon="arrow-down"
                ctaAction={ctaAction}
                restrictToRoutable
                minimumPolicy={minimumPolicy}
            />
        </NuqsTestingAdapter>
    )

beforeEach(() => ctaAction.mockClear())

const cta = () => screen.getByRole('button', { name: /Withdraw now/ })

describe('ExchangeRateWidget route minimum — a local-currency floor (1 BRL for PIX)', () => {
    const brlFloor = policyFor({ amount: 1, currency: 'BRL' })

    it('below: 0.15 USD → 0.75 BRL disables the CTA and names the BRL floor, not a USD one', () => {
        mockUseExchangeRate.mockReturnValue(quote(0.15, 5))
        renderWidget('BRL', brlFloor)

        expect(cta()).toBeDisabled()
        expect(screen.getByText('Minimum 1 BRL')).toBeInTheDocument()
        expect(screen.queryByText('Should arrive in minutes.')).not.toBeInTheDocument()
    })

    it('at: exactly 1.00 BRL is allowed', () => {
        mockUseExchangeRate.mockReturnValue(quote(0.2, 5))
        renderWidget('BRL', brlFloor)

        expect(cta()).toBeEnabled()
        expect(screen.queryByText('Minimum 1 BRL')).not.toBeInTheDocument()
        expect(screen.getByText('Should arrive in minutes.')).toBeInTheDocument()
    })

    it('above: a normal amount is untouched', () => {
        mockUseExchangeRate.mockReturnValue(quote(10, 5))
        renderWidget('BRL', brlFloor)

        expect(cta()).toBeEnabled()
        expect(screen.getByText('Should arrive in minutes.')).toBeInTheDocument()
    })

    it('resolves the floor with the widget rate, the same rate the quote used', () => {
        mockUseExchangeRate.mockReturnValue(quote(10, 5.2))
        renderWidget('BRL', brlFloor)

        expect(brlFloor.resolve).toHaveBeenCalledWith(5.2)
    })
})

describe('ExchangeRateWidget route minimum — a USD floor (Manteca / Bridge)', () => {
    const usdFloor = policyFor({ amount: 1, currency: 'USD' })

    it('below: 0.5 USD is refused against "You send"', () => {
        mockUseExchangeRate.mockReturnValue(quote(0.5, 1350))
        renderWidget('ARS', usdFloor)

        expect(cta()).toBeDisabled()
        expect(screen.getByText('Minimum 1 USD')).toBeInTheDocument()
    })

    it('at and above: 1 USD and 2 USD pass', () => {
        mockUseExchangeRate.mockReturnValue(quote(1, 1350))
        const { unmount } = renderWidget('ARS', usdFloor)
        expect(cta()).toBeEnabled()
        unmount()

        mockUseExchangeRate.mockReturnValue(quote(2, 1350))
        renderWidget('ARS', usdFloor)
        expect(cta()).toBeEnabled()
    })

    /*
     * `?amount=` is user-editable and may carry more decimals than the fields
     * show. The gate must never round a sub-minimum up: 0.995 is below $1 on
     * the route (parseUsdAmount keeps six decimals), so it is below $1 here.
     */
    it('boundary: 0.995 USD does not pass a $1 floor', () => {
        mockUseExchangeRate.mockReturnValue(quote(0.995, 1350))
        renderWidget('ARS', usdFloor)

        expect(cta()).toBeDisabled()
        expect(screen.getByText('Minimum 1 USD')).toBeInTheDocument()
    })

    it('boundary: 0.9999999 USD is below $1 at payload precision, 1.0000001 is not', () => {
        mockUseExchangeRate.mockReturnValue(quote(0.9999999, 1350))
        const { unmount } = renderWidget('ARS', usdFloor)
        expect(cta()).toBeDisabled()
        unmount()

        mockUseExchangeRate.mockReturnValue(quote(1.0000001, 1350))
        renderWidget('ARS', usdFloor)
        expect(cta()).toBeEnabled()
        fireEvent.click(cta())
        // what the route receives is what the gate checked
        expect(ctaAction).toHaveBeenCalledWith('USD', 'ARS', 1)
    })

    it('boundary: a BRL floor never rounds 0.999 BRL up to 1', () => {
        // 0.1998 USD × 5 = 0.999 BRL
        mockUseExchangeRate.mockReturnValue(quote(0.1998, 5))
        renderWidget('BRL', policyFor({ amount: 1, currency: 'BRL' }))

        expect(cta()).toBeDisabled()
    })
})

describe('ExchangeRateWidget route minimum — when the gate must stay out of the way', () => {
    it('never gates without a policy (marketing callers)', () => {
        mockUseExchangeRate.mockReturnValue(quote(0.01, 5))
        renderWidget('BRL')

        expect(cta()).toBeEnabled()
    })

    it('does not gate on a floor the route reports as none', () => {
        mockUseExchangeRate.mockReturnValue(quote(0.01, 5))
        renderWidget('BRL', policyFor(null))

        expect(cta()).toBeEnabled()
    })

    it('waits for a landed quote: no verdict while the rate is loading', () => {
        const policy = policyFor({ amount: 1, currency: 'BRL' })
        mockUseExchangeRate.mockReturnValue(quote(0.15, 0, { destinationAmount: '', isLoading: true }))
        renderWidget('BRL', policy)

        expect(cta()).toBeEnabled()
        expect(policy.resolve).not.toHaveBeenCalled()
    })

    it('a caller-disabled CTA stays disabled regardless of the floor', () => {
        mockUseExchangeRate.mockReturnValue(quote(10, 5))
        render(
            <NuqsTestingAdapter searchParams={{ from: 'USD', to: 'BRL', amount: '10' }}>
                <ExchangeRateWidget
                    ctaLabel="Withdraw now"
                    ctaIcon="arrow-down"
                    ctaAction={jest.fn()}
                    ctaDisabled
                    restrictToRoutable
                    minimumPolicy={policyFor({ amount: 1, currency: 'BRL' })}
                />
            </NuqsTestingAdapter>
        )

        expect(cta()).toBeDisabled()
    })
})
