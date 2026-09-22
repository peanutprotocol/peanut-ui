import { nextTileIndex } from '../avatarPicker.utils'

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
