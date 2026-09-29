import { IntlWrapper } from '@/test-utils/intl'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

import { RequestCurrencyPicker } from '../RequestCurrencyPicker'

const renderPicker = (props: Partial<React.ComponentProps<typeof RequestCurrencyPicker>> = {}) => {
    const onChange = jest.fn()
    render(<RequestCurrencyPicker currency="USD" onChange={onChange} accountCurrencies={[]} bankPayable {...props} />, {
        wrapper: IntlWrapper,
    })
    return onChange
}

const optionCodes = () => screen.getAllByRole('option').map((option) => option.textContent?.match(/[A-Z]{3}/)?.[0])

describe('RequestCurrencyPicker', () => {
    it('shows the request currency and offers the currencies the FX service quotes', () => {
        renderPicker()

        fireEvent.click(screen.getByRole('button', { name: 'Request currency: USD' }))

        expect(optionCodes()).toEqual(['USD', 'EUR', 'GBP', 'MXN', 'ARS', 'BRL', 'COP'])
    })

    // The requester's own account currencies are the ones a payer can pay exactly.
    it('lists the requester’s account currencies first', () => {
        renderPicker({ accountCurrencies: ['MXN', 'EUR'] })

        fireEvent.click(screen.getByRole('button', { name: 'Request currency: USD' }))

        expect(optionCodes()).toEqual(['MXN', 'EUR', 'USD', 'GBP', 'ARS', 'BRL', 'COP'])
    })

    it('reports the chosen currency', () => {
        const onChange = renderPicker()

        fireEvent.click(screen.getByRole('button', { name: 'Request currency: USD' }))
        fireEvent.click(screen.getByRole('option', { name: /EUR/ }))

        expect(onChange).toHaveBeenCalledWith('EUR')
    })

    it('explains exact and estimated amounts for a non-dollar request only', () => {
        renderPicker({ currency: 'EUR', bankPayable: true })
        expect(screen.getByText(/A payer who pays by bank in EUR sees this exact amount\./)).toBeInTheDocument()
    })

    // Without shared bank details nobody can pay this request by bank, so the
    // note would promise an exact amount on a method the payer is never offered.
    it('says nothing about bank amounts when the bank details stay private', () => {
        renderPicker({ currency: 'EUR', bankPayable: false })
        expect(screen.queryByText(/sees this exact amount/)).not.toBeInTheDocument()
    })

    it('says nothing extra for a dollar request', () => {
        renderPicker()
        expect(screen.queryByText(/sees this exact amount/)).not.toBeInTheDocument()
    })

    // The currency is part of what the request was created with.
    it('does not open once the request exists', () => {
        renderPicker({ disabled: true })

        fireEvent.click(screen.getByRole('button', { name: 'Request currency: USD' }))

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
})
