/**
 * SaveAddressPrompt — the "Save to address book" field on the withdraw review.
 * Pins the sep-23 review follow-up (A47/A50): the field is labelled "Name", as
 * in the edit drawer, the label stays visible after typing, and a missing name
 * becomes a field error once the user has been in the field.
 */
import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import SaveAddressPrompt from '../SaveAddressPrompt'

function Harness({ initialName = '' }: { initialName?: string }) {
    const [checked, setChecked] = useState(true)
    const [name, setName] = useState(initialName)
    return (
        <SaveAddressPrompt checked={checked} nickname={name} onCheckedChange={setChecked} onNicknameChange={setName} />
    )
}

const renderPrompt = (initialName?: string) => render(<Harness initialName={initialName} />, { wrapper: IntlWrapper })

describe('SaveAddressPrompt', () => {
    it('labels the field "Name" and keeps the label after typing', () => {
        renderPrompt()
        const input = screen.getByLabelText('Name')
        fireEvent.change(input, { target: { value: 'Binance' } })
        expect(screen.getByLabelText('Name')).toHaveValue('Binance')
        expect(screen.getByText('Name')).toBeVisible()
    })

    it('shows the missing name as a hint before the user has been in the field', () => {
        renderPrompt()
        expect(screen.getByText('Name this address to save it.')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('turns the missing name into a field error once the field is left empty', () => {
        renderPrompt()
        const input = screen.getByLabelText('Name')
        fireEvent.blur(input)
        const error = screen.getByTestId('save-address-name-error')
        expect(error).toHaveTextContent('Name this address to save it.')
        expect(error).toHaveAttribute('role', 'alert')
        expect(input).toHaveAttribute('aria-describedby', error.id)
    })

    it('shows no error while a name is set', () => {
        renderPrompt('Cold')
        fireEvent.blur(screen.getByLabelText('Name'))
        expect(screen.queryByTestId('save-address-name-error')).not.toBeInTheDocument()
        expect(screen.queryByText('Name this address to save it.')).not.toBeInTheDocument()
    })
})
