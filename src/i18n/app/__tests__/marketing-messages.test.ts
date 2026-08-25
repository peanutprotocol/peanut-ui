import fs from 'fs'
import path from 'path'
import namespaces from '../marketing-namespaces.json'

/*
 * The marketing catalogs are generated (scripts/generate-marketing-messages.js)
 * rather than hand-kept, so the risk is drift: a namespace added to the app
 * catalog, or a string changed, without regenerating. A stale subset shows up
 * as raw message keys on the marketing site, so it is worth failing the build
 * over rather than discovering visually.
 */
const MESSAGES_DIR = path.join(__dirname, '..', 'messages')
const LOCALES = ['en', 'es-419', 'es-AR', 'pt-BR'] as const

const read = (file: string) => JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf8'))

describe('marketing message catalogs', () => {
    it.each(LOCALES)('%s subset matches the source catalog', (locale) => {
        const source = read(`${locale}.json`)
        const subset = read(`${locale}.marketing.json`)
        const expected: Record<string, unknown> = {}
        for (const ns of namespaces) {
            // non-English catalogs are partial by design — deepMerge fills the
            // rest from English — so a missing namespace is expected there
            if (ns in source) expected[ns] = source[ns]
        }
        expect(subset).toEqual(expected)
    })

    it('covers every namespace the marketing routes use', () => {
        // Guards the generator's list against a new namespace being introduced
        // on the landing page without being added here.
        expect(new Set(namespaces)).toEqual(new Set(['common', 'errors', 'migration', 'shhhhh']))
    })

    it('is a small fraction of the full catalog', () => {
        const full = fs.statSync(path.join(MESSAGES_DIR, 'en.json')).size
        const subset = fs.statSync(path.join(MESSAGES_DIR, 'en.marketing.json')).size
        expect(subset).toBeLessThan(full * 0.2)
    })
})
