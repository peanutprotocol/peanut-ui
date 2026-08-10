import { render } from '@testing-library/react'
import { CTA } from '@/components/Marketing/mdx/CTA'

describe('CTA', () => {
    it('exposes a semantic layout hook only for the card variant', () => {
        const { container, rerender } = render(<CTA text="Start" href="https://example.com" variant="card" />)

        expect(container.querySelector('[data-mdx-cta="card"]')).toBeInTheDocument()

        rerender(<CTA text="Start" href="https://example.com" variant="primary" />)

        expect(container.querySelector('[data-mdx-cta]')).not.toBeInTheDocument()
    })
})
