/** @jest-environment node */
/**
 * P4-61 key parity for the 09–12 copy (contract P4 § 2–5) and P4-46 banned phrases in every setupRedesign value.
 * Reads the raw catalog files, so a key missing from a locale file cannot hide behind the English fallback.
 */
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import esAR from '@/i18n/app/messages/es-AR.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

const CATALOGS: Record<string, unknown> = { en, 'es-AR': esAR, 'es-419': es419, 'pt-BR': ptBR }

const P4_KEYS: Record<string, string[]> = {
    common: ['continue', 'notNow', 'retry'],
    email: [
        'title',
        'desc',
        'label',
        'placeholder',
        'note',
        'invalid',
        'taken',
        'logIn',
        'deferred',
        'suggest',
        'recover',
        'saveFailed',
        'clearAria',
    ],
    notif: ['title', 'desc', 'cta', 'push1Title', 'push1Body', 'push2Title', 'push2Body', 'denied', 'openSettings'],
    final: [
        'title',
        'desc',
        'cta',
        'what',
        'busy',
        'later',
        'setupFailed',
        'retrySetup',
        'infoTitle',
        'infoWhat',
        'infoBackup',
        'infoPrivacy',
        'gotIt',
        'fullGuide',
    ],
    done: ['title', 'sub', 'going', 'claimTitle', 'claimSub', 'claimGoing'],
}
const KEYS = Object.entries(P4_KEYS).flatMap(([group, keys]) => keys.map((key) => `setupRedesign.${group}.${key}`))
// The rich tag each link line carries (P4 copy rules: the mock's <a> is <link>).
const LINK_KEYS = ['setupRedesign.notif.openSettings', 'setupRedesign.final.what', 'setupRedesign.final.later']

const at = (catalog: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog)
const tags = (value: string) =>
    [...value.matchAll(/<\/?([a-zA-Z]+)\s*\/?>/g)].map((m) => m[0].replace(/\s/g, '')).sort()
const placeholders = (value: string) => [...value.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort()

describe('P4-61 key parity for 09–12', () => {
    it('lists the 45 keys of the contract (v7 adds logIn, deferred and suggest, drops useOther)', () => {
        expect(KEYS).toHaveLength(45)
    })

    it.each(Object.keys(CATALOGS))('every key is a non-empty string in %s', (locale) => {
        const missing = KEYS.filter((key) => {
            const value = at(CATALOGS[locale], key)
            return typeof value !== 'string' || !value.trim()
        })
        expect(missing).toEqual([])
    })

    it.each(KEYS)('%s has the same tags and placeholders in every locale', (key) => {
        const source = at(en, key) as string
        for (const locale of Object.keys(CATALOGS)) {
            const value = at(CATALOGS[locale], key)
            if (typeof value !== 'string') continue // reported by the presence test
            expect({ locale, tags: tags(value), placeholders: placeholders(value) }).toEqual({
                locale,
                tags: tags(source),
                placeholders: placeholders(source),
            })
        }
    })

    it.each(LINK_KEYS)('%s is one <link> line in en', (key) => {
        expect(tags(at(en, key) as string)).toEqual(['</link>', '<link>'])
    })
})

describe('P4-46 banned phrases', () => {
    const strings = (node: unknown, path = 'setupRedesign'): Array<[string, string]> =>
        typeof node === 'string'
            ? [[path, node]]
            : Object.entries((node ?? {}) as Record<string, unknown>).flatMap(([k, v]) => strings(v, `${path}.${k}`))

    it.each(Object.keys(CATALOGS))('no setupRedesign value in %s says "no password" or "Example"', (locale) => {
        const hits = strings((CATALOGS[locale] as { setupRedesign?: unknown }).setupRedesign).filter(([, value]) =>
            /no password|sin contraseña|sem senha|\bexample\b|\bejemplo\b/i.test(value)
        )
        expect(hits).toEqual([])
    })

    it('final.infoWhat ends at "screen lock." in en', () => {
        expect((at(en, 'setupRedesign.final.infoWhat') as string).replace(/ /g, ' ')).toMatch(/screen lock\.$/)
    })
})
