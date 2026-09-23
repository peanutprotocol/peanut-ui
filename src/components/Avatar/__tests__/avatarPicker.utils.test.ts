import { readFileSync } from 'fs'
import { join } from 'path'
import { HAND_WIDE_MIN, nextTileIndex } from '../avatarPicker.utils'

// five tiles in two columns: rows [0 1] [2 3] [4]
describe('nextTileIndex', () => {
    it('walks left and right through the whole hand and wraps at the ends', () => {
        expect(nextTileIndex(2, 1, 5)).toBe(3)
        expect(nextTileIndex(4, 1, 5)).toBe(0)
        expect(nextTileIndex(0, -1, 5)).toBe(4)
    })

    it('keeps its column going up and down, wrapping within the column', () => {
        expect(nextTileIndex(0, 2, 5)).toBe(2)
        expect(nextTileIndex(2, 2, 5)).toBe(4)
        expect(nextTileIndex(4, 2, 5)).toBe(0)
        expect(nextTileIndex(1, 2, 5)).toBe(3)
        expect(nextTileIndex(3, 2, 5)).toBe(1)
        expect(nextTileIndex(2, -2, 5)).toBe(0)
        expect(nextTileIndex(0, -2, 5)).toBe(4)
        expect(nextTileIndex(1, -2, 5)).toBe(3)
        expect(nextTileIndex(3, -2, 5)).toBe(1)
        expect(nextTileIndex(4, -2, 5)).toBe(2)
    })
})

// the JS hand size and the CSS `xs:` classes must switch at the same width, so
// both read one literal (a px query drifts from a rem breakpoint when the
// browser's default font size is not 16px)
describe('HAND_WIDE_MIN', () => {
    it('is the literal of the xs breakpoint token in globals.css', () => {
        const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
        expect(css.match(/--breakpoint-xs:\s*([^;]+);/)?.[1].trim()).toBe(HAND_WIDE_MIN)
    })
})
