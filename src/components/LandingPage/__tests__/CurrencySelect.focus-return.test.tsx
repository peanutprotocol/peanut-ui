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
