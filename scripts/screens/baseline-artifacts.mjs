const LOCALES = ['en', 'es-419', 'es-AR', 'pt-BR']
const localePattern = '(?:en|es-419|es-AR|pt-BR)'

function parseArtifact(name, kind, expectedCommit) {
    if (kind === 'baseline') {
        const match = new RegExp(`^screen-library-baseline-${expectedCommit}-(${localePattern})-([1-9]\\d*)$`).exec(
            name
        )
        return match ? { name, locale: match[1], attempt: Number(match[2]), explicitLocale: true } : null
    }
    const match = new RegExp(`^screen-library-after(?:-(${localePattern}))?-([1-9]\\d*)$`).exec(name)
    return match
        ? { name, locale: match[1] ?? 'en', attempt: Number(match[2]), explicitLocale: Boolean(match[1]) }
        : null
}

/**
 * Select one baseline artifact per locale from one trusted Actions run.
 * Baseline runs contain baseline artifacts; integration runs contain after artifacts.
 * The explicit English artifact wins over the legacy English alias at the same attempt.
 */
export function selectBaselineArtifacts(names, kind, expectedCommit) {
    if (!['baseline', 'integration'].includes(kind)) throw new Error(`Unsupported baseline kind: ${kind}`)
    const selected = new Map()
    for (const name of names) {
        const candidate = parseArtifact(name, kind, expectedCommit)
        if (!candidate) continue
        const current = selected.get(candidate.locale)
        if (!current || candidate.attempt > current.attempt) selected.set(candidate.locale, candidate)
        else if (candidate.attempt === current.attempt) {
            if (candidate.explicitLocale && !current.explicitLocale) selected.set(candidate.locale, candidate)
            else if (candidate.explicitLocale === current.explicitLocale)
                throw new Error(`Ambiguous external baseline artifacts for locale ${candidate.locale}`)
        }
    }
    return LOCALES.map((locale) => selected.get(locale)).filter(Boolean)
}
