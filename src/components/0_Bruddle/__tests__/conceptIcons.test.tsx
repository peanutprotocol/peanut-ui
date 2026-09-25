import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import { IconBubble, type IconBubbleColor } from '../IconBubble'
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
        const { color } = CONCEPT_ICONS[concept]
        expect(bubble).toHaveClass(color === 'brand' ? 'bg-background-brand' : `bg-background-icon-bubble-${color}`)
        warn.mockRestore()
    })

    test('uses the icon-bubble tones; only QR pay takes the brand fill, never a logo fill', () => {
        for (const concept of CONCEPTS) {
            const allowed = concept === 'qrPay' ? ['brand'] : ['green', 'red', 'yellow', 'gray', 'blue']
            expect(allowed).toContain(CONCEPT_ICONS[concept].color)
        }
    })

    // QA 2026-09-25: the nav QR button was pink and the Accounts and payments
    // QR row green. The brand fill is the nav button's action-primary pink.
    test('QR pay is the pink of the bottom nav QR button', () => {
        expect(CONCEPT_ICONS.qrPay).toEqual({ icon: 'qr-code', color: 'brand' })
        const css = readFileSync(join(__dirname, '..', '..', '..', 'styles', 'globals.css'), 'utf8')
        const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*([^;]+);`))?.[1]
        expect(token('background-brand')).toBeDefined()
        expect(token('background-brand')).toBe(token('action-primary'))
    })

    // QA 2026-09-25: a Peanut reward drew its star on green in activity
    test('rewards is the home top-nav star on yellow', () => {
        expect(CONCEPT_ICONS.rewards.color).toBe('yellow')
        expect(CONCEPT_ICONS.rewards.icon.props.src).toBe(STAR_STRAIGHT_ICON)
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
