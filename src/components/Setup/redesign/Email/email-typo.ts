/** Mailbox providers whose misspelled domain gets a "Did you mean" fix, all on `.com`. */
const COMMON_PROVIDERS = ['gmail', 'hotmail', 'outlook', 'yahoo', 'icloud', 'live']

/** Real providers one edit away from a common one (mail → gmail, ymail → gmail): never "fixed". */
const REAL_NEIGHBOURS = ['mail', 'ymail', 'email', 'gmx']

/** Top-level domains that are only ever a slip of `.com`. */
const TLD_SLIPS: Record<string, string> = { con: 'com', cmo: 'com' }

/** Short names ("live") would match too many real domains at one edit; they get only the TLD fix. */
const MIN_FUZZY_LENGTH = 5

/** Edit distance with adjacent transpositions (gmial → gmail is one edit). */
function editDistance(a: string, b: string): number {
    const d = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    )
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
            }
        }
    }
    return d[a.length][b.length]
}

/**
 * The address with its domain fixed ("maria@gmial.com" → "maria@gmail.com", "maria@company.con" →
 * "maria@company.com"), or null when the domain looks right. The local part is never changed.
 */
export function suggestEmailFix(email: string): string | null {
    const value = email.trim()
    const at = value.lastIndexOf('@')
    if (at < 1) return null
    const domain = value.slice(at + 1).toLowerCase()
    const labels = domain.split('.')
    if (labels.length < 2 || labels.some((label) => !label)) return null

    const tld = labels[labels.length - 1]
    labels[labels.length - 1] = TLD_SLIPS[tld] ?? tld
    if (labels.length === 2 && labels[1] === 'com') {
        const name = labels[0]
        if (!COMMON_PROVIDERS.includes(name) && !REAL_NEIGHBOURS.includes(name)) {
            const match = COMMON_PROVIDERS.find(
                (provider) => provider.length >= MIN_FUZZY_LENGTH && editDistance(name, provider) === 1
            )
            if (match) labels[0] = match
        }
    }

    const fixed = labels.join('.')
    return fixed === domain ? null : `${value.slice(0, at)}@${fixed}`
}
