/** One term to link, with every spelling it takes across the landing catalogs. */
export interface LinkedTerm {
    aliases: string[]
    href: string
}

/** A run of the original text. `href` is set only on the matched terms. */
export interface LinkedTextPart {
    text: string
    href?: string
}

/**
 * Split a translated sentence around known terms so each match can be wrapped
 * in a link at render time.
 *
 * The sentence stays one catalog string, so no locale loses its translation to
 * a restructure. A term whose aliases are all absent from `text` is simply not
 * matched, and that part of the sentence renders as plain text — a translator
 * rewording "Mexico City" costs a link, never the sentence.
 */
export function linkTerms(text: string, terms: LinkedTerm[]): LinkedTextPart[] {
    const matches: Array<{ start: number; end: number; href: string }> = []

    for (const term of terms) {
        // longest alias first: "Madrid" must win over its own prefix "Madri"
        for (const alias of [...term.aliases].sort((a, b) => b.length - a.length)) {
            const start = text.indexOf(alias)
            if (start === -1) continue
            matches.push({ start, end: start + alias.length, href: term.href })
            break
        }
    }

    matches.sort((a, b) => a.start - b.start)

    const parts: LinkedTextPart[] = []
    let cursor = 0
    for (const match of matches) {
        // a term overlapping one already taken is dropped rather than nested
        if (match.start < cursor) continue
        if (match.start > cursor) parts.push({ text: text.slice(cursor, match.start) })
        parts.push({ text: text.slice(match.start, match.end), href: match.href })
        cursor = match.end
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor) })

    return parts
}
