import { nextTileIndex } from '../avatarPicker.utils'

// eight tiles in three columns: rows [0 1 2] [3 4 5] [6 7]
describe('nextTileIndex', () => {
    it('walks left and right through the whole hand and wraps at the ends', () => {
        expect(nextTileIndex(3, 1, 8)).toBe(4)
        expect(nextTileIndex(7, 1, 8)).toBe(0)
        expect(nextTileIndex(0, -1, 8)).toBe(7)
    })

    it('keeps its column going up and down, wrapping within the column', () => {
        expect(nextTileIndex(0, 3, 8)).toBe(3)
        expect(nextTileIndex(6, 3, 8)).toBe(0)
        expect(nextTileIndex(7, 3, 8)).toBe(1)
        expect(nextTileIndex(5, 3, 8)).toBe(2)
        expect(nextTileIndex(3, -3, 8)).toBe(0)
        expect(nextTileIndex(0, -3, 8)).toBe(6)
        expect(nextTileIndex(1, -3, 8)).toBe(7)
        expect(nextTileIndex(2, -3, 8)).toBe(5)
    })
})
