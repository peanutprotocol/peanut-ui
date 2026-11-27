import { render, screen } from '@testing-library/react'
import { BadgeImage } from '../BadgeImage'

describe('BadgeImage', () => {
    it('keeps the OS image preview and drag lift off the badge art (TASK-25259)', () => {
        render(<BadgeImage src="/badges/example.svg" alt="Example badge" width={64} height={64} />)

        const img = screen.getByAltText('Example badge')
        expect(img).toHaveAttribute('draggable', 'false')
        expect((img.style as CSSStyleDeclaration & { WebkitTouchCallout?: string }).WebkitTouchCallout).toBe('none')
    })

    it('keeps a style the caller passes', () => {
        render(
            <BadgeImage src="/badges/example.svg" alt="Styled badge" width={64} height={64} style={{ opacity: 0.5 }} />
        )

        expect(screen.getByAltText('Styled badge')).toHaveStyle({ opacity: '0.5' })
    })
})
