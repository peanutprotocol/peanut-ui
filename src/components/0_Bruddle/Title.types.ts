import type { ReactNode } from 'react'

/** A decoration Title anchors on one word, e.g. the hand-drawn circle around "pink". */
export interface TitleMark {
    /** The word to wrap, any case. The first line that holds it gets the mark. */
    word: string
    /** Absolutely positioned inside the word's box, painted under the letters (give it a negative z-index). */
    node: ReactNode
    /** Text colour class of the ground behind the title (e.g. `text-background-brand`). Title fills
        the letters' outline area with it above the mark, so the mark never shows inside a letter. */
    knockoutClassName: string
}

export interface TitleProps {
    text: string
    className?: string
    /** false paints the outline exactly on the fill (no up-left misregistration) */
    offset?: boolean
    /**
     * Per-letter markup for the Follow the pull hero (public/dev/knerd/hero.js): every
     * glyph is its own anchor > magnet > glyph box, with the outline inside the glyph,
     * so a transform always moves fill and outline together. The letters are
     * aria-hidden and one sr-only copy of `text` names the title. At rest it reads
     * like the static Title.
     */
    letters?: boolean
    /** `letters` only: a small Roboto word set inside a line ("US and EUROPE"). It
        tilts with its line but is not a letter, so it never moves on its own. */
    join?: string
    /** Static mode only: a decoration anchored on one word. */
    mark?: TitleMark
}
