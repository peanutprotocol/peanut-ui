import { knownNonvisual } from './capture-plan.mjs'

export const CAPTURE_LOCALES = ['en', 'es-419', 'es-AR', 'pt-BR']
export const ALL_LOCALES_LABEL = 'screens:all-locales'

const localeBySlug = { 'es-419': 'es-419', 'es-ar': 'es-AR', 'pt-br': 'pt-BR' }
// es-AR stores only its differences from es-419, so es-419 copy also renders in es-AR.
const inheritedBy = { 'es-419': ['es-AR'] }
const translationCatalogue = /^src\/i18n\/(?:app\/messages\/)?(en|es-419|es-AR|pt-BR)(?:\.marketing)?\.json$/
const sharedLocalization = /^src\/(?:i18n\/|content(?:\/|$))/
const namedLocale = /(?:^|\/)(es-419|es-ar|pt-br)(?=[./]|$)/i

/**
 * Every release, manual and unknown capture keeps all locales. PRs and dev pushes capture English plus
 * only the locales whose own translations or locale-named files changed.
 */
export function planCaptureLocales({ event, branch, changedFiles, labels } = {}) {
    const all = (reason) => ({ locales: [...CAPTURE_LOCALES], reasons: [reason] })
    if (!['pull_request', 'push'].includes(event) || branch !== 'dev')
        return all('Release, manual and unknown captures keep every locale')
    if (event === 'pull_request') {
        if (!Array.isArray(labels) || !labels.every((label) => typeof label === 'string'))
            return all('PR label evidence is invalid')
        if (labels.includes(ALL_LOCALES_LABEL)) return all(`The ${ALL_LOCALES_LABEL} label requests every locale`)
    }
    if (
        !Array.isArray(changedFiles) ||
        !changedFiles.length ||
        !changedFiles.every((path) => typeof path === 'string' && path.length > 0)
    )
        return all('Changed-file evidence is missing or invalid')
    const selected = new Set(['en'])
    for (const path of changedFiles) {
        if (knownNonvisual(path)) continue
        const catalogue = translationCatalogue.exec(path)?.[1]
        if (catalogue) selected.add(catalogue)
        else if (sharedLocalization.test(path)) return all('Shared localization or content source changed')
        else {
            const named = namedLocale.exec(path)?.[1]
            if (named) selected.add(localeBySlug[named.toLowerCase()])
        }
    }
    for (const locale of [...selected]) for (const inherited of inheritedBy[locale] ?? []) selected.add(inherited)
    const locales = CAPTURE_LOCALES.filter((locale) => selected.has(locale))
    const added = locales.filter((locale) => locale !== 'en')
    return {
        locales,
        reasons: [
            added.length
                ? `English plus locales whose own copy changed: ${added.join(', ')}`
                : 'English only; no locale-specific copy changed',
        ],
    }
}

/** Every locale the trusted plan requires must be present; extra captured locales are allowed. */
export function missingLocales(required, captured) {
    const present = new Set(captured)
    return required.filter((locale) => !present.has(locale))
}
