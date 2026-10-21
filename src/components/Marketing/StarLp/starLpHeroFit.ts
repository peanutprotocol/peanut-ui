import type { CSSProperties } from 'react'
import { knerdLetters } from '@/components/0_Bruddle/Title.consts'

/**
 * The star-LP hero h1 fills its fold like the peanut.me hero: every line is
 * sized so it runs close to the full column width, then capped (see
 * .star-lp-fit-* in globals.css). CSS cannot measure text, so each line's
 * width is worked out here from per-glyph advances, in em. The server renders
 * the final size, so the hero never jumps after hydration.
 *
 * Advances were measured in Chromium at 1000px on the hero's own elements:
 * Knerd Filled with the Title's -0.065em tracking, Roboto Flex extrablack
 * untracked, both in caps. Kerning moves a real line by up to 5% either way,
 * so the fill factors in globals.css leave that much room.
 */
const KNERD_ADVANCE: Record<string, number> = {
    A: 0.574,
    B: 0.587,
    C: 0.533,
    D: 0.569,
    E: 0.572,
    F: 0.599,
    G: 0.625,
    H: 0.628,
    I: 0.254,
    J: 0.442,
    K: 0.639,
    L: 0.597,
    M: 0.789,
    N: 0.724,
    O: 0.543,
    P: 0.571,
    Q: 0.672,
    R: 0.614,
    S: 0.615,
    T: 0.627,
    U: 0.644,
    V: 0.654,
    W: 0.809,
    X: 0.758,
    Y: 0.73,
    Z: 0.675,
    ' ': 0.185,
    '.': 0.197,
    ',': 0.214,
    '?': 0.383,
    '!': 0.204,
    "'": 0.118,
    '"': 0.306,
    '“': 0.306,
    '”': 0.306,
    '&': 0.687,
    '-': 0.534,
    ':': 0.197,
}

const DISPLAY_ADVANCE: Record<string, number> = {
    A: 0.726,
    B: 0.696,
    C: 0.705,
    D: 0.73,
    E: 0.615,
    F: 0.594,
    G: 0.715,
    H: 0.761,
    I: 0.331,
    J: 0.61,
    K: 0.707,
    L: 0.571,
    M: 0.958,
    N: 0.737,
    O: 0.758,
    P: 0.669,
    Q: 0.758,
    R: 0.669,
    S: 0.655,
    T: 0.622,
    U: 0.717,
    V: 0.708,
    W: 1.026,
    X: 0.668,
    Y: 0.643,
    Z: 0.647,
    ' ': 0.244,
    '.': 0.355,
    ',': 0.334,
    '?': 0.617,
    '!': 0.37,
    "'": 0.209,
    '"': 0.432,
    '“': 0.6,
    '”': 0.6,
    '&': 0.71,
    '-': 0.328,
    ':': 0.357,
}

/** Digits share one advance in both faces. */
const DIGIT_ADVANCE = { knerd: 0.497, display: 0.564 } as const

/** Any glyph not in the table counts as a wide one, so a guess errs small, never past the edge. */
const FALLBACK_ADVANCE = { knerd: 0.72, display: 0.8 } as const

export type HeroFitFace = keyof typeof FALLBACK_ADVANCE

const ADVANCE: Record<HeroFitFace, Record<string, number>> = { knerd: KNERD_ADVANCE, display: DISPLAY_ADVANCE }

/** Width of the widest "\n" line of `text` in the face, in em. */
export function heroLineEm(text: string, face: HeroFitFace): number {
    const widths = text
        .split('\n')
        .map((line) =>
            [...line.toUpperCase()].reduce(
                (sum, glyph) =>
                    sum + (ADVANCE[face][glyph] ?? (/\d/.test(glyph) ? DIGIT_ADVANCE[face] : FALLBACK_ADVANCE[face])),
                0
            )
        )
    return Math.max(0.5, ...widths)
}

/** Inline custom properties the .star-lp-fit-* rules size the line from. */
export function heroFitStyle(em: number, lines = 1): CSSProperties {
    return { '--fit-em': em.toFixed(3), '--fit-lines': lines } as CSSProperties
}

/**
 * Follow the pull sets each Knerd letter in its own box, so pair kerning is
 * gone and a letter takes its own advance. These glyphs differ from the line
 * measurement above; measured the same way (Chromium, 1000px, -0.065em).
 */
const KNERD_LETTER_ADVANCE: Record<string, number> = { ...KNERD_ADVANCE, E: 0.594, N: 0.786, P: 0.583, X: 0.78 }

/** Roboto Flex 900 lower case at the join word's -0.035em tracking, em. */
const JOIN_ADVANCE: Record<string, number> = {
    a: 0.575,
    b: 0.593,
    c: 0.542,
    d: 0.593,
    e: 0.546,
    f: 0.291,
    g: 0.593,
    h: 0.58,
    i: 0.261,
    j: 0.264,
    k: 0.538,
    l: 0.26,
    m: 0.894,
    n: 0.58,
    o: 0.59,
    p: 0.593,
    q: 0.593,
    r: 0.342,
    s: 0.519,
    t: 0.315,
    u: 0.58,
    v: 0.503,
    w: 0.82,
    x: 0.523,
    y: 0.519,
    z: 0.479,
}

const isJoinWord = (word: string, join?: string) => !!join && word.toLowerCase() === join.toLowerCase()

/** Width of one Follow the pull line in em of the Knerd size: letters, a spacer between Knerd words, the join word with its margins. */
export function knerdPullLineEm(line: string, join?: string): number {
    const words = line.split(' ').filter(Boolean)
    const { space, join: joinType } = knerdLetters
    return words.reduce((sum, word, i) => {
        if (isJoinWord(word, join)) {
            const text = [...word.toLowerCase()].reduce(
                (w, glyph) => w + (JOIN_ADVANCE[glyph] ?? FALLBACK_ADVANCE.display),
                0
            )
            return sum + joinType.size * (text + 2 * parseFloat(joinType.marginInline))
        }
        const spacer = i > 0 && !isJoinWord(words[i - 1], join) ? space : 0
        const letters = [...word.toUpperCase()].reduce(
            (w, glyph) =>
                w + (KNERD_LETTER_ADVANCE[glyph] ?? (/\d/.test(glyph) ? DIGIT_ADVANCE.knerd : FALLBACK_ADVANCE.knerd)),
            0
        )
        return sum + spacer + letters
    }, 0)
}

/**
 * The inline custom properties .star-lp-knerd-fit sizes a Follow the pull
 * headline from (globals.css): the wide phrase's width, and the widest
 * stacked line's width and the line count for 600px and below.
 */
export function knerdPullFitStyle(text: string, join?: string): CSSProperties {
    const lines = text.split('\n')
    return {
        '--knerd-em-wide': knerdPullLineEm(lines.join(' '), join).toFixed(3),
        '--knerd-em-stacked': Math.max(...lines.map((line) => knerdPullLineEm(line, join))).toFixed(3),
        '--knerd-lines-stacked': lines.length,
    } as CSSProperties
}
