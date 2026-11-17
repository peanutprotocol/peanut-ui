/** Stand-ins for the chips inside the translated "Did you mean" sentence; the catalogs give `{a}` and `{b}`. */
export const CHIP_MARKERS = { a: '\u0000chip0\u0000', b: '\u0000chip1\u0000' } as const

export type SuggestionPart = { text: string } | { chip: number; suffix: string }

/**
 * Splits the translated line ("Did you mean: {a} or {b}", "¿Quisiste decir {a}?") into its lead words and the
 * rest. Punctuation right after a chip ("?") rides with that chip, so it never wraps onto a line alone.
 */
export function splitSuggestionLine(line: string): { lead: string; parts: SuggestionPart[] } {
    const pieces = line.split(/\u0000chip(\d)\u0000/)
    const parts: SuggestionPart[] = []
    for (let i = 1; i < pieces.length; i += 2) {
        const [, suffix = '', text = ''] = pieces[i + 1].match(/^(\S*)([\s\S]*)$/) ?? []
        parts.push({ chip: Number(pieces[i]), suffix })
        if (text.trim()) parts.push({ text: text.trim() })
    }
    return { lead: pieces[0].trim(), parts }
}
