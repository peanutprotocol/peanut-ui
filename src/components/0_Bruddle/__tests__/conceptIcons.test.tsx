import { render } from '@testing-library/react'
import { IconBubble } from '../IconBubble'
import { CONCEPT_ICONS, type Concept } from '../conceptIcons'

const CONCEPTS = Object.keys(CONCEPT_ICONS) as Concept[]

describe('CONCEPT_ICONS', () => {
    test.each(CONCEPTS)('%s renders an icon inside its colored bubble', (concept) => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const { container } = render(<IconBubble {...CONCEPT_ICONS[concept]} size="s" />)
        const bubble = container.firstElementChild as HTMLElement

        // Icon returns null and warns for a name it does not know
        expect(bubble.querySelector('svg, img')).toBeInTheDocument()
        expect(warn).not.toHaveBeenCalled()
        expect(bubble).toHaveClass(`bg-background-icon-bubble-${CONCEPT_ICONS[concept].color}`)
        warn.mockRestore()
    })

    test('uses only the icon-bubble tones, no brand or logo fill', () => {
        for (const concept of CONCEPTS) {
            expect(['green', 'red', 'yellow', 'gray', 'blue']).toContain(CONCEPT_ICONS[concept].color)
        }
    })

    test('gray stays the inactive tone: no concept is gray', () => {
        expect(CONCEPTS.filter((concept) => CONCEPT_ICONS[concept].color === 'gray')).toEqual([])
    })

    // QA-32: the Send picker drew crypto with the card glyph
    test('crypto, bank and card are three different glyphs', () => {
        const glyphs = [CONCEPT_ICONS.crypto.icon, CONCEPT_ICONS.bank.icon, CONCEPT_ICONS.card.icon]
        expect(new Set(glyphs).size).toBe(3)
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
