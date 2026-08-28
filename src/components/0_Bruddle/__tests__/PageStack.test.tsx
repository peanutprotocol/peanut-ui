import { render, screen } from '@testing-library/react'
import { PageStack } from '../PageStack'

describe('PageStack', () => {
    test('renders regions in order with the page gap', () => {
        const { container } = render(
            <PageStack data-testid="stack">
                <header>nav</header>
                <PageStack.Center>
                    <p>content</p>
                </PageStack.Center>
                <PageStack.Footer>
                    <button>cta</button>
                </PageStack.Footer>
            </PageStack>
        )
        const stack = screen.getByTestId('stack')
        expect(stack).toHaveClass('gap-8', 'flex-col', 'min-h-[inherit]')
        // dom order is the layout contract: header, centered content, footer
        expect(Array.from(container.querySelectorAll('header, p, button').values()).map((n) => n.tagName)).toEqual([
            'HEADER',
            'P',
            'BUTTON',
        ])
    })

    test('gap 6 variant swaps only the gap', () => {
        render(<PageStack gap="6" data-testid="stack" />)
        expect(screen.getByTestId('stack')).toHaveClass('gap-6')
        expect(screen.getByTestId('stack')).not.toHaveClass('gap-8')
    })

    test('Center centers via my-auto, Footer pins via mt-auto', () => {
        render(
            <PageStack>
                <PageStack.Center data-testid="center" />
                <PageStack.Footer data-testid="footer" />
            </PageStack>
        )
        expect(screen.getByTestId('center')).toHaveClass('my-auto')
        expect(screen.getByTestId('footer')).toHaveClass('mt-auto')
    })

    test('caller className merges over the defaults', () => {
        render(<PageStack className="gap-4" data-testid="stack" />)
        const stack = screen.getByTestId('stack')
        expect(stack).toHaveClass('gap-4')
        expect(stack).not.toHaveClass('gap-8')
    })
})
