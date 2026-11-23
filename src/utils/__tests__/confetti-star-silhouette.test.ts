import { readFileSync } from 'fs'
import { join } from 'path'
import { STAR_OUTLINE_PATH, starSilhouettes } from '@/utils/confetti-star-silhouette'

const realPath2D = global.Path2D
const realDOMMatrix = global.DOMMatrix

beforeEach(() => {
    Object.assign(global, { Path2D: class {}, DOMMatrix: class {} })
})

afterEach(() => {
    Object.assign(global, { Path2D: realPath2D, DOMMatrix: realDOMMatrix })
})

describe('starSilhouettes', () => {
    it('uses the outline that is in star.svg, not a redrawn one', () => {
        const svg = readFileSync(join(process.cwd(), 'src/assets/illustrations/star.svg'), 'utf8')

        expect(svg).toContain(`<path d="${STAR_OUTLINE_PATH}"`)
    })

    it('scales the 70 x 83 star to each height and centres it on the particle', () => {
        expect(starSilhouettes([83, 41.5])).toEqual([
            { type: 'path', path: STAR_OUTLINE_PATH, matrix: [1, 0, 0, 1, -35, -41.5] },
            { type: 'path', path: STAR_OUTLINE_PATH, matrix: [0.5, 0, 0, 0.5, -17.5, -20.75] },
        ])
    })

    it('refuses where the browser cannot draw a path, so no other shape is drawn instead', () => {
        Object.assign(global, { Path2D: undefined })

        expect(() => starSilhouettes([50])).toThrow('path confetti unsupported')
    })
})
