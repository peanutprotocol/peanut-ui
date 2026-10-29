/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DrawerSelect } from '../DrawerSelect'

beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn()
})

const OPTIONS = [
    { value: 'bank' as const, label: 'Bank transfer' },
    { value: 'crypto' as const, label: 'Crypto' },
]

const renderSelect = (onChange: (value: 'bank' | 'crypto') => void | Promise<void>, value: 'bank' | 'crypto' | null) =>
    render(
        <DrawerSelect
            title="Add money with"
            options={OPTIONS}
            value={value}
            onChange={onChange}
            trigger={<button type="button">Choose</button>}
        />
    )

it('marks only the chosen row with the selection fill', () => {
    renderSelect(jest.fn(), 'crypto')
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Add money with' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Crypto' })).toHaveClass('bg-background-selection')
    expect(within(dialog).getByRole('button', { name: 'Bank transfer' })).not.toHaveClass('bg-background-selection')
})

it('shows no selected row when nothing is chosen yet', () => {
    renderSelect(jest.fn(), null)
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }))
    const rows = within(screen.getByRole('dialog')).getAllByRole('button', { name: /Bank transfer|Crypto/ })
    rows.forEach((row) => expect(row).not.toHaveClass('bg-background-selection'))
})

it('closes only after an async choice resolves', async () => {
    let resolve: () => void = () => {}
    const onChange = jest.fn(() => new Promise<void>((r) => (resolve = r)))
    renderSelect(onChange, null)
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Bank transfer' }))

    expect(onChange).toHaveBeenCalledWith('bank')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'open')
    await act(async () => resolve())
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
})
