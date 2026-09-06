/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { CountryCombobox } from '@/components/Common/CountryCombobox'
import { buildResidenceCountryOptions } from '@/utils/residence-options'

const options = buildResidenceCountryOptions('en')

const render = (props?: Partial<React.ComponentProps<typeof CountryCombobox>>) => {
    const onValueChange = jest.fn()
    rtlRender(
        <CountryCombobox
            options={options}
            placeholder="Select your country"
            onValueChange={onValueChange}
            {...props}
        />,
        { wrapper: IntlWrapper }
    )
    return { onValueChange, input: screen.getByRole('combobox') as HTMLInputElement }
}

describe('CountryCombobox', () => {
    it('shows the picked country name as its value and no list until focused', () => {
        const { input } = render({ value: 'PT' })
        expect(input.value).toBe('Portugal')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('opens the full list on focus with the current country marked selected', () => {
        const { input } = render({ value: 'PT' })
        fireEvent.focus(input)
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        expect(screen.getAllByRole('option').length).toBe(options.length)
        expect(screen.getByRole('option', { name: 'Portugal' })).toHaveAttribute('aria-selected', 'true')
    })

    it('filters by name, ignoring case and accents', () => {
        const { input } = render()
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: 'gu' } })
        const names = screen.getAllByRole('option').map((option) => option.textContent)
        expect(names).toEqual(expect.arrayContaining(['Guatemala', 'Uruguay', 'Paraguay']))
        expect(names).not.toContain('Brazil')

        fireEvent.change(input, { target: { value: 'MEXI' } })
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Mexico'])

        // "Turkiye" is spelled Türkiye by Intl.DisplayNames — a plain "turk" must still find it
        fireEvent.change(input, { target: { value: 'turk' } })
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
            expect.arrayContaining([expect.stringMatching(/T(ü|u)rk/)])
        )
    })

    it('reports the picked value and closes the list on click', () => {
        const { onValueChange, input } = render({ value: 'PT' })
        fireEvent.click(input)
        fireEvent.click(screen.getByRole('option', { name: 'Brazil' }))
        expect(onValueChange).toHaveBeenCalledWith('BR')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('is keyboard navigable: arrows move, Enter picks, Escape closes', () => {
        const { onValueChange, input } = render()
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        fireEvent.change(input, { target: { value: 'arg' } })
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onValueChange).toHaveBeenCalledWith('AR')

        fireEvent.focus(input)
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('shows an empty state when nothing matches and a clear button restores the list', () => {
        const { input } = render()
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: 'zzzz' } })
        expect(screen.queryAllByRole('option')).toHaveLength(0)
        expect(screen.getByText('No countries match')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
        expect(input.value).toBe('')
        expect(screen.getAllByRole('option').length).toBe(options.length)
    })

    it('restores the picked name after blurring without a choice', () => {
        const { input } = render({ value: 'PT' })
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: 'gu' } })
        fireEvent.blur(input)
        expect(input.value).toBe('Portugal')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    // usePullToRefresh binds touchmove on `document` and only bails on window.scrollY > 0,
    // so scrolling the inline list at page top would read as a pull-to-refresh.
    describe('pull-to-refresh guard', () => {
        const onDocumentTouchMove = jest.fn()

        beforeEach(() => {
            onDocumentTouchMove.mockClear()
            document.addEventListener('touchmove', onDocumentTouchMove)
        })

        afterEach(() => {
            document.removeEventListener('touchmove', onDocumentTouchMove)
        })

        it('does not let a touchmove inside the open list reach the document listener', () => {
            const { input } = render()
            fireEvent.focus(input)
            fireEvent.touchMove(screen.getByRole('option', { name: 'Brazil' }), {
                touches: [{ clientX: 0, clientY: 40 }],
            })
            expect(onDocumentTouchMove).not.toHaveBeenCalled()
        })

        it('still lets a touchmove on the field itself reach the document listener', () => {
            const { input } = render()
            fireEvent.touchMove(input, { touches: [{ clientX: 0, clientY: 40 }] })
            expect(onDocumentTouchMove).toHaveBeenCalled()
        })
    })
})
