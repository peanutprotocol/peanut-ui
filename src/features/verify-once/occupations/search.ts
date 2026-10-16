export const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Query words cut to a stem, so a plural or the feminine form finds the
 * list's masculine singular titles: "enfermeras" finds "Enfermero",
 * "contadora" finds "Contador".
 */
export function searchStems(query: string): string[] {
    return normalizeSearch(query)
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => (word.length > 4 ? word.replace(/(es|s)$/, '') : word))
        .map((word) => (word.length > 3 ? word.replace(/[ao]$/, '') : word))
}

/**
 * Jobs whose label in the user's locale (or code, which is English) holds
 * every query stem; a label that starts with the first stem comes first,
 * then one with a word starting with it, then the rest, each alphabetically.
 */
export function searchOccupations(
    codes: readonly string[],
    labelOf: (code: string) => string,
    query: string,
    locale: string
): string[] {
    const stems = searchStems(query)
    if (!stems.length) return [...codes]
    const collator = new Intl.Collator(locale)
    const rank = (label: string) => {
        if (label.startsWith(stems[0])) return 0
        return label.split(/[\s(,/-]+/).some((word) => word.startsWith(stems[0])) ? 1 : 2
    }
    return codes
        .map((code) => ({ code, label: labelOf(code), text: normalizeSearch(labelOf(code)) }))
        .filter(({ code, text }) => {
            const haystack = `${text} ${code.replace(/_/g, ' ')}`
            return stems.every((stem) => haystack.includes(stem))
        })
        .sort((a, b) => rank(a.text) - rank(b.text) || collator.compare(a.label, b.label))
        .map(({ code }) => code)
}
