import { render, screen } from '@testing-library/react'
import BaseInput from '../BaseInput'

// error state rides aria-invalid: .input paints aria-invalid:border-border-error,
// and the same attribute tells screen readers the field is invalid. there is no
// separate state prop.
describe('BaseInput', () => {
    it('sets no aria-invalid by default', () => {
        render(<BaseInput placeholder="name" />)
        expect(screen.getByPlaceholderText('name')).not.toHaveAttribute('aria-invalid')
    })

    it('passes a caller aria-invalid through to the input', () => {
        render(<BaseInput placeholder="name" aria-invalid />)
        expect(screen.getByPlaceholderText('name')).toHaveAttribute('aria-invalid', 'true')
    })

    it('renders rightContent in the trailing slot', () => {
        render(<BaseInput placeholder="amount" rightContent={<span>USD</span>} />)
        expect(screen.getByText('USD')).toBeInTheDocument()
    })

    it('disabled input stays disabled', () => {
        render(<BaseInput placeholder="name" disabled />)
        expect(screen.getByPlaceholderText('name')).toBeDisabled()
    })
})
