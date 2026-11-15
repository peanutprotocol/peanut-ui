export type A1Highlight = 'yellow' | 'pink' | 'lilac'

/** One run of Nita's post. `highlight` and `marker` are Peanut's annotations; the words are hers. */
export type A1PostSegment = {
    text: string
    highlight?: A1Highlight
    /** The numbered dot after a highlighted phrase; it points at the matching proof card. */
    marker?: number
    kind?: 'mention' | 'cut'
}
