'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'

/** Job labels by Peanut occupation code (`financial_analyst`), in one locale. */
export type OccupationLabels = Readonly<Record<string, string>>

// Per-locale files keep 858 labels out of the main catalogs; es-AR holds only its deltas over es-419.
async function loadOccupationLabels(locale: string): Promise<OccupationLabels> {
    const en = (await import('./en.json')).default
    switch (locale) {
        case 'es-419':
            return { ...en, ...(await import('./es-419.json')).default }
        case 'es-AR': {
            const [es419, esAR] = await Promise.all([import('./es-419.json'), import('./es-AR.json')])
            return { ...en, ...es419.default, ...esAR.default }
        }
        case 'pt-BR':
            return { ...en, ...(await import('./pt-BR.json')).default }
        default:
            return en
    }
}

const loaded = new Map<string, Promise<OccupationLabels>>()

/** The job labels in the app locale, or null while they load. */
export function useOccupationLabels(enabled: boolean): OccupationLabels | null {
    const locale = useLocale()
    const [state, setState] = useState<{ locale: string; labels: OccupationLabels } | null>(null)

    useEffect(() => {
        if (!enabled) return
        let current = true
        let labels = loaded.get(locale)
        if (!labels) {
            labels = loadOccupationLabels(locale)
            loaded.set(locale, labels)
        }
        labels
            .then((result) => current && setState({ locale, labels: result }))
            // a failed chunk load retries on the next open; the codes read as words meanwhile
            .catch(() => loaded.delete(locale))
        return () => {
            current = false
        }
    }, [enabled, locale])

    return state?.locale === locale ? state.labels : null
}

/** A code with no label yet still reads as words: `financial_analyst` → "Financial analyst". */
export function humanizeOccupation(code: string): string {
    const words = code.replace(/_/g, ' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
}
