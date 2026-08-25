import { fireEvent, screen } from '@testing-library/react'
// the dismiss aria-label comes from the common catalog via useTranslations
import { renderWithIntl as render } from '@/test-utils/intl'
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
        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    })

    test('dismiss button calls onDismiss', () => {
        const onDismiss = jest.fn()
        render(
            <Notification priority="info" onDismiss={onDismiss}>
                Bye
            </Notification>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
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

    // the unlock modals shipped the (i) in front of the checklist for one round.
    // Every InfoCard call-site that passed items passed no icon, so the rule is
    // "a checklist has no leading icon" — asserted by svg count: one check mark
    // per row and nothing else.
    test('a checklist renders no leading priority icon, only the check marks', () => {
        const { container: withItems } = render(<Notification priority="info" items={['One', 'Two']} />)
        expect(withItems.querySelectorAll('svg')).toHaveLength(2)

        const { container: withBody } = render(<Notification priority="info">Plain body</Notification>)
        expect(withBody.querySelectorAll('svg')).toHaveLength(1)
    })

    test('an empty items list renders nothing, not a bare icon box', () => {
        const { container } = render(<Notification priority="info" items={[]} />)
        expect(container).toBeEmptyDOMElement()
    })

    test('an empty items list suppresses children rather than falling back to them', () => {
        const { container } = render(
            <Notification priority="info" items={[]}>
                should not appear
            </Notification>
        )
        expect(container).toBeEmptyDOMElement()
    })

    test('a title alone still renders', () => {
        render(<Notification priority="info" title="Heads up" items={[]} />)
        expect(screen.getByText('Heads up')).toBeInTheDocument()
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
