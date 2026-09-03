import { render, screen } from '@testing-library/react'
import { FieldColumn } from '../FieldColumn'

describe('FieldColumn', () => {
    test('stacks the input and its FieldError in the 4px board column', () => {
        const { container } = render(
            <FieldColumn error="Invalid IBAN" errorTestId="error-alert">
                <input />
            </FieldColumn>
        )
        expect(container.firstChild).toHaveClass('flex', 'flex-col', 'gap-1')
        const alert = screen.getByTestId('error-alert')
        expect(alert).toHaveTextContent('Invalid IBAN')
        expect(alert).toHaveAttribute('role', 'alert')
    })

    test('renders no error element when there is no message', () => {
        render(
            <FieldColumn>
                <input />
            </FieldColumn>
        )
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
