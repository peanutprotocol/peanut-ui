import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next/image', () => ({
    __esModule: true,
    default: () => null,
}))

import CurrencySelect from '../CurrencySelect'

// usePullToRefresh binds touchmove on `document` and only bails on window.scrollY > 0,
// so a scrollable overlay sitting at page top reads as a pull-to-refresh. This asserts
// the panel's onTouchMove guard keeps the gesture from ever reaching that listener.
describe('CurrencySelect pull-to-refresh guard (TASK-21967)', () => {
    const onDocumentTouchMove = jest.fn()

    beforeEach(() => {
        onDocumentTouchMove.mockClear()
        document.addEventListener('touchmove', onDocumentTouchMove)
    })

    afterEach(() => {
        document.removeEventListener('touchmove', onDocumentTouchMove)
    })

    const open = () => {
        render(
            <CurrencySelect selectedCurrency="USD" setSelectedCurrency={jest.fn()} trigger={<button>pick</button>} />
        )
        fireEvent.click(screen.getByText('pick'))
    }

    it('does not let a touchmove inside the open panel reach the document listener', () => {
        open()

        // A row deep inside the scroll area — the element a finger actually drags.
        fireEvent.touchMove(screen.getByText('Popular currencies'), { touches: [{ clientX: 0, clientY: 40 }] })

        expect(onDocumentTouchMove).not.toHaveBeenCalled()
    })

    it('still lets a touchmove outside the panel reach the document listener', () => {
        open()

        fireEvent.touchMove(screen.getByText('pick'), { touches: [{ clientX: 0, clientY: 40 }] })

        expect(onDocumentTouchMove).toHaveBeenCalled()
    })
})
