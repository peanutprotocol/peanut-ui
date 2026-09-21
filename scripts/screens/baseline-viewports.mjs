import { captureProfile } from './capture-profiles.mjs'
import { validateCapture } from './core.mjs'

export const BASELINE_LOCALES = Object.freeze(['en', 'es-419', 'es-AR', 'pt-BR'])
export const ADDITIONAL_PROFILES = Object.freeze(['440x956', '360x800', '320x712'])
const localeSlugs = { en: 'en', 'es-419': 'es-419', 'es-AR': 'es-ar', 'pt-BR': 'pt-br' }

export function baselineArtifactName(sha, locale, profile, attempt) {
    if (
        !/^[a-f0-9]{40}$/.test(sha) ||
        !BASELINE_LOCALES.includes(locale) ||
        !Number.isSafeInteger(attempt) ||
        attempt < 1
    )
        throw new Error('Invalid baseline artifact identity')
    captureProfile(profile)
    return `screen-library-baseline-${sha}-${locale}${profile === '393x852' ? '' : `-${profile}`}-${attempt}`
}

export function verifyBaselineMatrix({ sha, attempt, artifacts, readCapture }) {
    const expected = []
    for (const locale of BASELINE_LOCALES)
        for (const profile of ['393x852', ...ADDITIONAL_PROFILES]) {
            const name = baselineArtifactName(sha, locale, profile, attempt)
            const artifact = artifacts.find((item) => item.name === name && !item.expired)
            if (!artifact || artifacts.filter((item) => item.name === name).length !== 1)
                throw new Error(`Missing or duplicate baseline artifact: ${name}`)
            const capture = validateCapture(readCapture(name))
            if (capture.commit !== sha || capture.locale !== locale || capture.profile !== `${locale}-${profile}`)
                throw new Error(`Baseline capture identity mismatch: ${name}`)
            expected.push({ name, locale, slug: localeSlugs[locale], profile, capture })
        }
    return expected
}
