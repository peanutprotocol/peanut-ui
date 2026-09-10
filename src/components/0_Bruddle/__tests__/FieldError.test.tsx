import { render, screen } from '@testing-library/react'
import { FieldError } from '../FieldError'

describe('FieldError', () => {
    test('renders the message as role=alert in the board error style', () => {
        render(<FieldError>Username already taken</FieldError>)
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('Username already taken')
        expect(alert).toHaveClass('text-body-xs', 'text-foreground-error')
    })

    test('renders nothing when there is no message', () => {
        const { container } = render(<FieldError>{''}</FieldError>)
        expect(container).toBeEmptyDOMElement()
    })
})
