import { fireEvent, screen } from '@testing-library/react'
// the dismiss aria-label comes from the common catalog via useTranslations
import { renderWithIntl as render } from '@/test-utils/intl'
import { ModalsProvider, useModalsContext } from '@/context/ModalsContext'
import { Callout } from '../Callout'

describe('Callout', () => {
    test('body-only renders as a status with the body text', () => {
        render(<Callout priority="info">Just letting you know</Callout>)
        expect(screen.getByRole('status')).toHaveTextContent('Just letting you know')
    })

    test('error and attention priorities render as alerts', () => {
        render(<Callout priority="error">Something went wrong</Callout>)
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    test('attention renders role=alert too (the branch every warning toast rides)', () => {
        render(<Callout priority="attention">Careful now</Callout>)
        expect(screen.getByRole('alert')).toHaveTextContent('Careful now')
    })

    test('hideIcon suppresses the leading priority icon for self-designed content', () => {
        const { container } = render(
            <Callout priority="success" hideIcon>
                badge content
            </Callout>
        )
        expect(container.querySelector('svg')).not.toBeInTheDocument()
    })

    test('title + body renders both, no dismiss button unless onDismiss is set', () => {
        render(
            <Callout priority="attention" title="Heads up">
                Body text
            </Callout>
        )
        expect(screen.getByText('Heads up')).toBeInTheDocument()
        expect(screen.getByText('Body text')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    })

    test('dismiss button calls onDismiss', () => {
        const onDismiss = jest.fn()
        render(
            <Callout priority="info" onDismiss={onDismiss}>
                Bye
            </Callout>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    // the unlock modals pass their whole list through `items` and no children.
    // an earlier revision of the items prop computed the list and then rendered
    // `children` anyway, which typechecked, passed every other test, and showed
    // an empty blue box in the modal.
    test('items renders one row per entry, with no children', () => {
        render(<Callout priority="info" items={['Europe SEPA transfers', 'UK Faster payments']} />)
        expect(screen.getByText('Europe SEPA transfers')).toBeInTheDocument()
        expect(screen.getByText('UK Faster payments')).toBeInTheDocument()
    })

    test('items wins over children, and renders under a title too', () => {
        render(
            <Callout priority="info" title="What you'll unlock" items={['Mexico SPEI transfers']}>
                ignored
            </Callout>
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
        const { container: withItems } = render(<Callout priority="info" items={['One', 'Two']} />)
        expect(withItems.querySelectorAll('svg')).toHaveLength(2)

        const { container: withBody } = render(<Callout priority="info">Plain body</Callout>)
        expect(withBody.querySelectorAll('svg')).toHaveLength(1)
    })

    test('an empty items list renders nothing, not a bare icon box', () => {
        const { container } = render(<Callout priority="info" items={[]} />)
        expect(container).toBeEmptyDOMElement()
    })

    test('an empty items list suppresses children rather than falling back to them', () => {
        const { container } = render(
            <Callout priority="info" items={[]}>
                should not appear
            </Callout>
        )
        expect(container).toBeEmptyDOMElement()
    })

    test('a title alone still renders', () => {
        render(<Callout priority="info" title="Heads up" items={[]} />)
        expect(screen.getByText('Heads up')).toBeInTheDocument()
    })

    test('inline callout renders only link-button actions', () => {
        const first = jest.fn()
        // the tuple type caps ctas at two at compile time; the cast proves the
        // runtime slice also guards plain-js callers
        const threeCtas = [
            { label: 'One', onClick: first },
            { label: 'Two', onClick: () => {} },
            { label: 'Three', onClick: () => {} },
        ] as unknown as [{ label: string; onClick: () => void }]
        render(
            <Callout priority="success" ctas={threeCtas}>
                Done
            </Callout>
        )
        const firstAction = screen.getByRole('button', { name: 'One' })
        const secondAction = screen.getByRole('button', { name: 'Two' })
        expect(firstAction).toHaveClass('underline')
        expect(secondAction).toHaveClass('underline')
        expect(firstAction).not.toHaveClass('min-w-28')
        expect(secondAction).not.toHaveClass('min-w-28')
        expect(screen.queryByRole('button', { name: /Three/ })).not.toBeInTheDocument()
        fireEvent.click(firstAction)
        expect(first).toHaveBeenCalledTimes(1)
    })

    // TASK-23054: a toast times out, so the floating card drops both actions and
    // the close button, even when a caller passes them
    test('floating toast omits actions and the close button', () => {
        const ctas: [{ label: string; onClick: () => void }] = [{ label: 'Retry', onClick: jest.fn() }]
        const { rerender, container } = render(
            // @ts-expect-error floating never takes ctas — the type blocks it, this checks the runtime guard too
            <Callout priority="error" variant="floating" ctas={ctas} onDismiss={jest.fn()}>
                Try again later
            </Callout>
        )
        expect(screen.getByRole('alert')).toHaveTextContent('Try again later')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()

        // @ts-expect-error floating never takes ctas
        rerender(<Callout priority="error" variant="floating" ctas={ctas} />)
        expect(container).toBeEmptyDOMElement()
    })

    // chip flagged the countdown running through prefers-reduced-motion. The bar
    // is informative rather than decorative, but law 4 wins: a continuous
    // animation for the whole lifetime of every toast is what the preference is
    // for. Under motion-reduce it stays as a static tone strip.
    test('the countdown bar animates only under motion-safe, and is absent without a duration', () => {
        const { container, rerender } = render(
            <Callout priority="success" variant="floating" progressMs={2000}>
                Link cancelled successfully!
            </Callout>
        )
        const bar = container.querySelector('span[aria-hidden]')
        expect(bar).toBeInTheDocument()
        expect(bar).toHaveClass('motion-safe:animate-toast-progress')
        // the unguarded class would run for everyone
        expect(bar?.className).not.toMatch(/(^|\s)animate-toast-progress/)
        expect(bar).toHaveStyle({ animationDuration: '2000ms' })

        // a persistent toast has no lifetime to draw
        rerender(
            <Callout priority="success" variant="floating">
                Link cancelled successfully!
            </Callout>
        )
        expect(container.querySelector('span[aria-hidden]')).not.toBeInTheDocument()
    })

    test('the floating timer bar cannot intercept taps', () => {
        const { container } = render(
            <Callout priority="success" variant="floating" progressMs={2000}>
                Link cancelled successfully!
            </Callout>
        )
        expect(container.querySelector('span[aria-hidden]')).toHaveClass('pointer-events-none')
    })

    test('the inline banner never draws a countdown, even if a duration is passed', () => {
        const { container } = render(
            <Callout priority="success" progressMs={2000}>
                Link cancelled successfully!
            </Callout>
        )
        expect(container.querySelector('span[aria-hidden]')).not.toBeInTheDocument()
    })
})

describe('Callout support CTA', () => {
    // shows what the support drawer would open with
    const SupportProbe = () => {
        const { isSupportModalOpen, supportPrefilledMessage } = useModalsContext()
        return <div data-testid="support-probe">{isSupportModalOpen ? supportPrefilledMessage : 'closed'}</div>
    }
    const renderInApp = (ui: React.ReactElement) =>
        render(
            <ModalsProvider>
                {ui}
                <SupportProbe />
            </ModalsProvider>
        )

    test('an error that says to contact support opens the drawer with the error prefilled', () => {
        renderInApp(<Callout priority="error">Transfer failed. Please contact support.</Callout>)
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(screen.getByTestId('support-probe')).toHaveTextContent(
            'I got this error in the app: Transfer failed. Please contact support.'
        )
    })

    test('reads text rendered by a child component, and in Spanish and Portuguese', () => {
        const Message = () => <span>Hubo un problema. Contactá con soporte.</span>
        const { unmount } = renderInApp(
            <Callout priority="error">
                <Message />
            </Callout>
        )
        expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
        unmount()
        renderInApp(<Callout priority="error">Entre em contato com o suporte.</Callout>)
        expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
    })

    test('no CTA when the error does not mention support', () => {
        renderInApp(<Callout priority="error">This token is unsupported on this network</Callout>)
        expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
    })

    test.each([
        "Peanut doesn't support recurring PIX payments. Ask for a regular PIX QR code instead.",
        'Peanut no admite este QR. Solo cuentas bancarias donde haya soporte.',
        'Só contas bancárias onde houver suporte.',
    ])('no CTA when support is not the next step: %s', (text) => {
        renderInApp(<Callout priority="error">{text}</Callout>)
        expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
    })

    test.each(['Support can open another one for you.', 'O suporte pode verificar.', 'Fale com o suporte.'])(
        'a CTA when the error points at support: %s',
        (text) => {
            renderInApp(<Callout priority="error">{text}</Callout>)
            expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
        }
    )

    test('no CTA on non-error priorities', () => {
        renderInApp(<Callout priority="info">Our support team replies within a day</Callout>)
        expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
    })

    test('caller ctas win over the automatic one', () => {
        const onClick = jest.fn()
        renderInApp(
            <Callout priority="error" ctas={[{ label: 'Retry', onClick }]}>
                Failed. Please try again or contact support.
            </Callout>
        )
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
    })

    test('no CTA without the modals provider (isolated trees)', () => {
        render(<Callout priority="error">Please contact support.</Callout>)
        expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
    })
})
