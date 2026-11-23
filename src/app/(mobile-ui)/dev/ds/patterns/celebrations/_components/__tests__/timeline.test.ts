import { HOLD, timeline } from '../timeline'

function setup() {
    const animate = jest.fn()
    const element = { animate } as unknown as Element
    return { element, animate }
}

describe('timeline', () => {
    it('turns pose times into offsets over the total', () => {
        const { element, animate } = setup()

        timeline(element, 1000, [
            [0, 'scale(0)', 'ease-in'],
            [500, 'scale(1)'],
            [1000, 'scale(0)'],
        ])

        const [keyframes, options] = animate.mock.calls[0]
        expect(keyframes).toEqual([
            { offset: 0, transform: 'scale(0)', easing: 'ease-in' },
            { offset: 0.5, transform: 'scale(1)', easing: 'linear' },
            { offset: 1, transform: 'scale(0)', easing: 'linear' },
        ])
        expect(options).toEqual({ duration: 1000, fill: 'both' })
    })

    it('holds the first pose until it starts and the last pose to the end', () => {
        const { element, animate } = setup()

        timeline(element, 1000, [
            [200, 'scale(0)'],
            [400, 'scale(1)'],
        ])

        const [keyframes] = animate.mock.calls[0]
        expect(keyframes[0]).toEqual({ offset: 0, transform: 'scale(0)', easing: HOLD })
        expect(keyframes[keyframes.length - 1]).toEqual({ offset: 1, transform: 'scale(1)' })
        expect(keyframes).toHaveLength(4)
    })

    it('clamps a pose past the total to the end', () => {
        const { element, animate } = setup()

        timeline(element, 1000, [
            [0, 'scale(0)'],
            [1200, 'scale(1)'],
        ])

        const [keyframes] = animate.mock.calls[0]
        expect(keyframes.map((keyframe: Keyframe) => keyframe.offset)).toEqual([0, 1])
    })
})
