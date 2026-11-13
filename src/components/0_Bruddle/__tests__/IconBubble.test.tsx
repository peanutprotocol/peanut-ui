import { render } from '@testing-library/react'
import PIX from '@/assets/payment-apps/pix.svg'
import { IconBubble } from '../IconBubble'

// board 17802:61528: xs=24 s=32 m=48 l=72; xl=96 is the avatar xl
const SIZES = [
    ['xs', 'size-6'],
    ['s', 'size-8'],
    ['m', 'size-12'],
    ['l', 'size-18'],
    ['xl', 'size-24'],
] as const

describe('IconBubble', () => {
    test.each(SIZES)('an icon at size %s sits in a %s coloured circle', (size, box) => {
        const { container } = render(<IconBubble icon="bank" color="blue" size={size} />)
        const bubble = container.firstElementChild as HTMLElement
        expect(bubble).toHaveClass(box, 'rounded-full', 'bg-background-icon-bubble-blue')
        expect(bubble.querySelector('svg')).toBeInTheDocument()
    })

    test('the default bubble is the m green one', () => {
        const { container } = render(<IconBubble icon="check" />)
        expect(container.firstElementChild).toHaveClass('size-12', 'bg-background-icon-bubble-green')
    })

    // a brand mark replaces the bubble (design.md: flags, chain and payment-brand
    // logos); the Pix mark is the first (Aleks 2026-11-12, TASK-24841)
    test.each(SIZES)('a logo at size %s is the whole %s circle, with no colour behind it', (size, box) => {
        const { container } = render(<IconBubble logo={PIX} size={size} />)
        const bubble = container.firstElementChild as HTMLElement
        expect(bubble).toHaveClass(box, 'rounded-full')
        expect(bubble.className).not.toMatch(/\bbg-/)
        expect(bubble.querySelector('svg')).toBeNull()
        const mark = bubble.querySelector('img')
        // decorative: the row or hero names Pix in its own text
        expect(mark).toHaveAttribute('alt', '')
        // the SVG scales to the bubble's diameter; the asset itself is not cropped or recoloured
        expect(mark).toHaveClass('size-full')
    })

    test('a logo bubble keeps the container attributes it is given', () => {
        const { getByTestId } = render(<IconBubble logo={PIX} size="s" data-testid="pix-mark" className="mx-auto" />)
        expect(getByTestId('pix-mark')).toHaveClass('size-8', 'mx-auto')
    })
})
