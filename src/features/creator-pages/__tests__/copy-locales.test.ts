import { SUPPORTED_LOCALES } from '@/i18n/types'
import { CREATOR_PAGE_EXPERIMENTS } from '../experiments'
import { NITA_A1_COPY } from '../pages/juanacervio/nita-a1.copy'
import { NITA_E1_COPY } from '../pages/juanacervio/nita-e1.copy'
import { NITA_G2_COPY } from '../pages/juanacervio/nita-g2.copy'

const COPIES = { a1: NITA_A1_COPY, g2: NITA_G2_COPY, e1: NITA_E1_COPY }

/** Every string of a copy object with its path, e.g. `proof.items.1.body`. */
function strings(value: unknown, path = ''): [string, string][] {
    if (typeof value === 'string') return [[path, value]]
    if (typeof value === 'number' || value === undefined) return []
    return Object.entries(value as object).flatMap(([key, child]) => strings(child, path ? `${path}.${key}` : key))
}

describe.each(Object.entries(COPIES))('Nita %s copy', (_variant, copy) => {
    const approved = new Map(strings(copy['es-ar']))

    it.each(SUPPORTED_LOCALES)('%s has every key of the approved es-AR copy, and no other', (locale) => {
        expect(strings(copy[locale]).map(([path]) => path)).toEqual([...approved.keys()])
    })

    it.each(SUPPORTED_LOCALES)('%s has no empty line', (locale) => {
        // A lone space between two runs of her post is a separator, not an empty line.
        for (const [path, text] of strings(copy[locale])) expect([path, text]).not.toEqual([path, ''])
    })

    // The layouts were made for the es-AR lines (buttons, headline boxes, the E1 strip). A line much
    // longer than its es-AR original needs a screenshot check before it ships.
    it.each(SUPPORTED_LOCALES)('%s keeps each line close to the length of its es-AR original', (locale) => {
        for (const [path, text] of strings(copy[locale])) {
            const original = approved.get(path) ?? ''
            expect([path, text.length <= original.length * 1.35 + 6]).toEqual([path, true])
        }
    })
})

describe('Nita’s own words', () => {
    // A quote is never translated: every locale shows the post exactly as she wrote it.
    it.each(SUPPORTED_LOCALES)('are the same in %s as in es-AR', (locale) => {
        expect(NITA_A1_COPY[locale].post.segments).toBe(NITA_A1_COPY['es-ar'].post.segments)
        expect(NITA_A1_COPY[locale].close.quote).toBe(NITA_A1_COPY['es-ar'].close.quote)
        expect(NITA_A1_COPY[locale].proof.items.map(({ before, phrase }) => before + phrase)).toEqual(
            NITA_A1_COPY['es-ar'].proof.items.map(({ before, phrase }) => before + phrase)
        )
        expect(NITA_E1_COPY[locale].post.runs).toBe(NITA_E1_COPY['es-ar'].post.runs)
    })
})

describe('tab titles', () => {
    it('has a title for every creator in every locale', () => {
        for (const experiment of Object.values(CREATOR_PAGE_EXPERIMENTS))
            expect(Object.keys(experiment.title).sort()).toEqual([...SUPPORTED_LOCALES].sort())
    })
})
