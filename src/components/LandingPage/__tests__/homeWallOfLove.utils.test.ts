import { advanceSlots, dealIntoSlots } from '../homeWallOfLove.utils'

describe('dealIntoSlots', () => {
    it('deals round-robin so the first screen is the first posts in curated order', () => {
        expect(dealIntoSlots([0, 1, 2, 3, 4, 5], 3)).toEqual([
            [0, 3],
            [1, 4],
            [2, 5],
        ])
    })

    it('keeps every post when they do not divide evenly', () => {
        expect(dealIntoSlots([0, 1, 2, 3, 4], 3)).toEqual([[0, 3], [1, 4], [2]])
    })

    it('makes no empty slots when there are fewer posts than slots', () => {
        expect(dealIntoSlots(['a', 'b'], 3)).toEqual([['a'], ['b']])
        expect(dealIntoSlots([], 3)).toEqual([])
    })
})

describe('advanceSlots', () => {
    it('moves only the slot whose turn it is, and wraps', () => {
        const sizes = [2, 2, 2]
        let active = [0, 0, 0]
        active = advanceSlots(active, 0, sizes)
        expect(active).toEqual([1, 0, 0])
        active = advanceSlots(active, 1, sizes)
        active = advanceSlots(active, 2, sizes)
        expect(active).toEqual([1, 1, 1])
        expect(advanceSlots(active, 3, sizes)).toEqual([0, 1, 1])
    })

    it('leaves a one-post slot alone', () => {
        expect(advanceSlots([0, 0, 0], 2, [2, 2, 1])).toEqual([0, 0, 0])
    })
})
