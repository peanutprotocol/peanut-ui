import { fireEvent, render, screen } from '@testing-library/react'
import { Notification } from '../Notification'

describe('Notification', () => {
    test('body-only renders as a status with the body text', () => {
        render(<Notification priority="info">Just letting you know</Notification>)
        expect(screen.getByRole('status')).toHaveTextContent('Just letting you know')
    })

    test('error and attention priorities render as alerts', () => {
        render(<Notification priority="error">Something went wrong</Notification>)
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    test('title + body renders both, no dismiss button unless onDismiss is set', () => {
        render(
            <Notification priority="attention" title="Heads up">
                Body text
            </Notification>
        )
        expect(screen.getByText('Heads up')).toBeInTheDocument()
        expect(screen.getByText('Body text')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    })

    test('dismiss button calls onDismiss', () => {
        const onDismiss = jest.fn()
        render(
            <Notification priority="info" onDismiss={onDismiss}>
                Bye
            </Notification>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    test('renders at most two CTAs and wires their clicks', () => {
        const first = jest.fn()
        render(
            <Notification
                priority="success"
                ctas={[
                    { label: 'One', onClick: first },
                    { label: 'Two', onClick: () => {} },
                    { label: 'Three', onClick: () => {} },
                ]}
            >
                Done
            </Notification>
        )
        expect(screen.getByRole('button', { name: /One/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Two/ })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Three/ })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /One/ }))
        expect(first).toHaveBeenCalledTimes(1)
    })
})
