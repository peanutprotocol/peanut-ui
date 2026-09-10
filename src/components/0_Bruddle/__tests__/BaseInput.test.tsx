import { render, screen } from '@testing-library/react'
import BaseInput from '../BaseInput'

// batch-3 contract: visual states live in the component (input board 17360:4441).
// error rides aria-invalid, which .input paints via aria-invalid:border-border-error.
describe('BaseInput', () => {
    it('default state sets no aria-invalid', () => {
        render(<BaseInput placeholder="name" />)
        expect(screen.getByPlaceholderText('name')).not.toHaveAttribute('aria-invalid')
    })

    it('state="error" sets aria-invalid so the DS error border applies', () => {
        render(<BaseInput placeholder="name" state="error" />)
        expect(screen.getByPlaceholderText('name')).toHaveAttribute('aria-invalid', 'true')
    })

    it('a caller-passed aria-invalid wins over the state prop', () => {
        render(<BaseInput placeholder="name" state="error" aria-invalid={false} />)
        expect(screen.getByPlaceholderText('name')).toHaveAttribute('aria-invalid', 'false')
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
