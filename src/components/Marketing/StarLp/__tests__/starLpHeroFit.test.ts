import { heroFitStyle, heroLineEm } from '../starLpHeroFit'

describe('heroLineEm', () => {
    it('sums the glyph advances of the widest line, in caps', () => {
        // P R O B L E M in Knerd Filled; the page measures 4.288em
        expect(heroLineEm('problem', 'knerd')).toBeCloseTo(4.273, 3)
        expect(heroLineEm('No\nproblem', 'knerd')).toBeCloseTo(heroLineEm('PROBLEM', 'knerd'), 6)
    })

    it('stays within 5% of the rendered width of the hero lines', () => {
        // widths measured in Chromium on the live hero elements, in em
        const rendered: Array<[string, 'knerd' | 'display', number]> = [
            ['IN PINK', 'knerd', 3.487],
            ['ONLY YOU', 'knerd', 4.494],
            ['EUROPE', 'knerd', 3.522],
            ['YOUR MONEY.', 'display', 7.085],
            ['“HOW DO I PAY YOU?”', 'display', 11.381],
        ]
        for (const [text, face, width] of rendered) {
            expect(Math.abs(heroLineEm(text, face) / width - 1)).toBeLessThan(0.05)
        }
    })

    it('counts an unknown glyph as a wide one', () => {
        expect(heroLineEm('É', 'display')).toBeGreaterThan(heroLineEm('E', 'display'))
    })
})

describe('heroFitStyle', () => {
    it('sets the width and line count the CSS sizes the line from', () => {
        expect(heroFitStyle(4.2735, 2)).toEqual({ '--fit-em': '4.274', '--fit-lines': 2 })
    })
})
