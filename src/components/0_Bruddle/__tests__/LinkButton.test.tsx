import { fireEvent, render, screen } from '@testing-library/react'
import { LinkButton } from '../LinkButton'

describe('LinkButton', () => {
    test('renders a link when href is set', () => {
        render(<LinkButton href="/history">View transaction</LinkButton>)
        expect(screen.getByRole('link', { name: /View transaction/ })).toHaveAttribute('href', '/history')
    })

    test('renders a button when no href, wires onClick', () => {
        const onClick = jest.fn()
        render(<LinkButton onClick={onClick}>See details</LinkButton>)
        fireEvent.click(screen.getByRole('button', { name: /See details/ }))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    test('disabled wins over href: renders a disabled button, not a link', () => {
        render(
            <LinkButton href="/history" disabled>
                View transaction
            </LinkButton>
        )
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /View transaction/ })).toBeDisabled()
    })

    test('external adds new-tab attributes', () => {
        render(
            <LinkButton href="https://docs.peanut.me" external>
                Docs
            </LinkButton>
        )
        const link = screen.getByRole('link', { name: /Docs/ })
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
})
