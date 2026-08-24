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

    // the unlock modals pass their whole list through `items` and no children.
    // an earlier revision of the items prop computed the list and then rendered
    // `children` anyway, which typechecked, passed every other test, and showed
    // an empty blue box in the modal.
    test('items renders one row per entry, with no children', () => {
        render(<Notification priority="info" items={['Europe SEPA transfers', 'UK Faster payments']} />)
        expect(screen.getByText('Europe SEPA transfers')).toBeInTheDocument()
        expect(screen.getByText('UK Faster payments')).toBeInTheDocument()
    })

    test('items wins over children, and renders under a title too', () => {
        render(
            <Notification priority="info" title="What you'll unlock" items={['Mexico SPEI transfers']}>
                ignored
            </Notification>
        )
        expect(screen.getByText("What you'll unlock")).toBeInTheDocument()
        expect(screen.getByText('Mexico SPEI transfers')).toBeInTheDocument()
        expect(screen.queryByText('ignored')).not.toBeInTheDocument()
    })

    test('renders at most two CTAs and wires their clicks', () => {
        const first = jest.fn()
        // the tuple type caps ctas at two at compile time; the cast proves the
        // runtime slice also guards plain-js callers
        const threeCtas = [
            { label: 'One', onClick: first },
            { label: 'Two', onClick: () => {} },
            { label: 'Three', onClick: () => {} },
        ] as unknown as [{ label: string; onClick: () => void }]
        render(
            <Notification priority="success" ctas={threeCtas}>
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
