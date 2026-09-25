import { render } from '@testing-library/react'
import { IconBubble, type IconBubbleColor } from '../IconBubble'
import { CONCEPT_ICONS, conceptBubbleFor, type Concept } from '../conceptIcons'

const CONCEPTS = Object.keys(CONCEPT_ICONS) as Concept[]

describe('CONCEPT_ICONS', () => {
    test.each(CONCEPTS)('%s renders an icon inside its colored bubble', (concept) => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const { container } = render(<IconBubble {...CONCEPT_ICONS[concept]} size="s" />)
        const bubble = container.firstElementChild as HTMLElement

        // Icon returns null and warns for a name it does not know
        expect(bubble.querySelector('svg, img')).toBeInTheDocument()
        expect(warn).not.toHaveBeenCalled()
        const { color } = CONCEPT_ICONS[concept]
        expect(bubble).toHaveClass(color === 'brand' ? 'bg-background-brand' : `bg-background-icon-bubble-${color}`)
        warn.mockRestore()
    })

    // TASK-22761: a concept is a method (blue) or Peanut's own (pink). green,
    // yellow, red and gray are states and never name a concept.
    test('uses only blue or pink', () => {
        for (const concept of CONCEPTS) {
            expect(['blue', 'brand']).toContain(CONCEPT_ICONS[concept].color)
        }
    })

    test("Peanut's own concepts are pink", () => {
        for (const concept of ['peanutUser', 'friends', 'card', 'rewards', 'badges'] as const) {
            expect(CONCEPT_ICONS[concept].color).toBe('brand')
        }
    })

    test('a state swaps the color and keeps the concept icon', () => {
        expect(conceptBubbleFor('sendLink', 'completed')).toEqual({ icon: 'link', color: 'blue' })
        expect(conceptBubbleFor('card', 'completed').color).toBe('brand')
        expect(conceptBubbleFor('sendLink', 'pending')).toEqual({ icon: 'link', color: 'yellow' })
        expect(conceptBubbleFor('crypto', 'processing').color).toBe('yellow')
        expect(conceptBubbleFor('bank', 'failed').color).toBe('red')
        expect(conceptBubbleFor('card', 'cancelled').color).toBe('gray')
        expect(conceptBubbleFor('card', 'refunded').color).toBe('gray')
        expect(conceptBubbleFor('qrPay').color).toBe('blue')
    })

    test('gray stays the inactive tone: no concept is gray', () => {
        const colors: IconBubbleColor[] = CONCEPTS.map((concept) => CONCEPT_ICONS[concept].color)
        expect(colors).not.toContain('gray')
    })

    // QA-32: the Send picker drew crypto with the card glyph
    test('crypto, bank and card are three different glyphs', () => {
        const glyphs = [CONCEPT_ICONS.crypto.icon, CONCEPT_ICONS.bank.icon, CONCEPT_ICONS.card.icon]
        expect(new Set(glyphs).size).toBe(3)
    })

    test('withdraw mirrors add money: arrow up against arrow down', () => {
        expect(CONCEPT_ICONS.addMoney.icon).toBe('arrow-down')
        expect(CONCEPT_ICONS.withdraw.icon).toBe('arrow-up')
    })

    test('only the two link concepts share a glyph', () => {
        const byGlyph = new Map<unknown, Concept[]>()
        for (const concept of CONCEPTS) {
            const { icon } = CONCEPT_ICONS[concept]
            byGlyph.set(icon, [...(byGlyph.get(icon) ?? []), concept])
        }
        const shared = [...byGlyph.values()].filter((concepts) => concepts.length > 1)
        expect(shared).toEqual([['sendLink', 'requestLink']])
    })
})
