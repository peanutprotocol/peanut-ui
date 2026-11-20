import type { Shape } from 'canvas-confetti'

// The star's outline, copied from the fill path of
// src/assets/illustrations/star.svg (70 x 83). A test fails if the file and
// this copy drift apart.
export const STAR_OUTLINE_PATH =
    'M21.8915 32.2248C26.4042 20.1482 21.8915 4 21.8915 4C21.8915 4 29.366 23.6113 42.5504 28.9991C50.0564 32.0664 63.2093 30.6119 63.2093 30.6119C63.2093 30.6119 52.4396 39.0624 48.9069 46.7403C44.4354 56.459 47.3178 74.1587 47.3178 74.1587C47.3178 74.1587 39.0412 57.258 29.0426 53.1917C19.52 49.319 6 53.1917 6 53.1917C6 53.1917 17.8336 43.084 21.8915 32.2248Z'

const STAR_WIDTH = 70
const STAR_HEIGHT = 83

/**
 * The brand star as a plain filled outline, one shape per requested height,
 * for browsers that cannot draw the star file as a bitmap. Same star, without
 * its black line and shadow; the caller sets the fill colour.
 */
export function starSilhouettes(heights: readonly number[]): Shape[] {
    // canvas-confetti draws a path shape through Path2D and DOMMatrix. Without
    // them it would draw its default square, so refuse: no star, no burst.
    if (typeof Path2D !== 'function' || typeof DOMMatrix !== 'function') {
        throw new Error('path confetti unsupported')
    }
    return heights.map((height) => {
        const scale = height / STAR_HEIGHT
        // The library reads the matrix as a plain six-number array (it has to
        // survive the post to the worker); its types call it a DOMMatrix.
        const matrix = [scale, 0, 0, scale, (-STAR_WIDTH / 2) * scale, (-STAR_HEIGHT / 2) * scale]
        return { type: 'path', path: STAR_OUTLINE_PATH, matrix: matrix as unknown as DOMMatrix }
    })
}
