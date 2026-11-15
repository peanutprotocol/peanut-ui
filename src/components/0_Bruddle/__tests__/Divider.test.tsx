import { render, screen } from '@testing-library/react'
import { Divider } from '../Divider'

describe('Divider', () => {
    test('draws a horizontal rule with the label between its two lines', () => {
        const { container } = render(<Divider text="or" />)

        expect(screen.getByText('or')).toBeInTheDocument()
        expect(container.querySelectorAll('.bg-border-default')).toHaveLength(2)
    })

    test('draws the vertical rule as one dashed left border that stretches with the columns', () => {
        render(
            <div>
                <p>Portugal</p>
                <Divider orientation="vertical" data-testid="rule" />
                <p>Brazil</p>
            </div>
        )

        const rule = screen.getByTestId('rule')
        expect(rule).toHaveClass('self-stretch', 'border-l', 'border-dashed', 'border-border-default')
        expect(rule).not.toHaveClass('border')
        expect(rule).toHaveAttribute('aria-hidden', 'true')
        expect(rule).toBeEmptyDOMElement()
    })
})
