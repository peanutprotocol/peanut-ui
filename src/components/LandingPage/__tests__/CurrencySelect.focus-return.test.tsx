import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next/image', () => ({
    __esModule: true,
    default: () => null,
}))

import CurrencySelect from '../CurrencySelect'

// The trigger's mousedown preventDefault (which keeps the toggle from
// blur-close-then-reopening) also stops the browser from focusing the trigger
// on click. Toggle-close must therefore refocus the trigger itself, or focus
// drops to document.body and keyboard/SR users lose their place.
describe('CurrencySelect focus return on toggle-close', () => {
    it('returns focus to the trigger when clicking it closes the open list', () => {
        render(
            <CurrencySelect selectedCurrency="USD" setSelectedCurrency={jest.fn()} trigger={<button>pick</button>} />
        )
        const trigger = screen.getByText('pick')

        fireEvent.click(trigger)
        expect(screen.getByRole('listbox')).toBeInTheDocument()

        fireEvent.click(trigger)
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(document.activeElement).toBe(trigger)
    })
})

// The selection path threads through the hand-rolled machinery (list
// onMouseDown preventDefault + wrapper blur-close) — a regression there
// silently kills currency switching.
describe('CurrencySelect selection', () => {
    it('clicking a row reports the currency once and closes the list', () => {
        const setSelectedCurrency = jest.fn()
        render(
            <CurrencySelect
                selectedCurrency="USD"
                setSelectedCurrency={setSelectedCurrency}
                trigger={<button>pick</button>}
            />
        )

        fireEvent.click(screen.getByText('pick'))
        fireEvent.click(screen.getByRole('option', { name: /EUR/ }))

        expect(setSelectedCurrency).toHaveBeenCalledTimes(1)
        expect(setSelectedCurrency).toHaveBeenCalledWith('EUR')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    // ponytail: no coming-soon click test — comingSoon comes from module-level
    // constant data (SUPPORTED_EXCHANGE_CURRENCIES x countryCurrencyMappings),
    // not from any prop, and no supported currency is coming-soon today; add one
    // by jest-mocking the constants module if a coming-soon entry ever ships.
})

// The hand-rolled keyboard path: moveActive wrap-around arithmetic, Home/End,
// Enter→select. Row order is SUPPORTED_EXCHANGE_CURRENCIES: USD, EUR, GBP,
// MXN, ARS, BRL — USD selected means the list opens with USD active.
describe('CurrencySelect keyboard navigation', () => {
    const openWithKeyboard = () => {
        const setSelectedCurrency = jest.fn()
        render(
            <CurrencySelect
                selectedCurrency="USD"
                setSelectedCurrency={setSelectedCurrency}
                trigger={<button>pick</button>}
            />
        )
        const trigger = screen.getByText('pick')
        fireEvent.click(trigger)
        return { setSelectedCurrency, trigger, listbox: screen.getByRole('listbox') }
    }

    const expectSelectedAndClosed = (setSelectedCurrency: jest.Mock, trigger: HTMLElement, currency: string) => {
        expect(setSelectedCurrency).toHaveBeenCalledTimes(1)
        expect(setSelectedCurrency).toHaveBeenCalledWith(currency)
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(document.activeElement).toBe(trigger)
    }

    it('ArrowDown then Enter selects the next currency and closes with focus on the trigger', () => {
        const { setSelectedCurrency, trigger, listbox } = openWithKeyboard()
        fireEvent.keyDown(listbox, { key: 'ArrowDown' })
        fireEvent.keyDown(listbox, { key: 'Enter' })
        expectSelectedAndClosed(setSelectedCurrency, trigger, 'EUR')
    })

    it('End then Enter selects the last currency', () => {
        const { setSelectedCurrency, trigger, listbox } = openWithKeyboard()
        fireEvent.keyDown(listbox, { key: 'End' })
        fireEvent.keyDown(listbox, { key: 'Enter' })
        expectSelectedAndClosed(setSelectedCurrency, trigger, 'BRL')
    })

    it('Home then Enter selects the first currency', () => {
        const { setSelectedCurrency, trigger, listbox } = openWithKeyboard()
        fireEvent.keyDown(listbox, { key: 'End' })
        fireEvent.keyDown(listbox, { key: 'Home' })
        fireEvent.keyDown(listbox, { key: 'Enter' })
        expectSelectedAndClosed(setSelectedCurrency, trigger, 'USD')
    })
})
