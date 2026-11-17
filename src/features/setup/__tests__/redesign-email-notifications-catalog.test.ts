/**
 * P4-61 [u] for 09 and 10: every setupRedesign.{common,email,notif} key of contract P4 §§ 1–3 exists in en, es-AR,
 * es-419 and pt-BR with the same rich-text tags and placeholders, and the dev keys the screens reuse resolve in
 * every locale.
 */
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import esAR from '@/i18n/app/messages/es-AR.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'
import { deepMerge, type DeepPartial } from '@/i18n/app/deep-merge'

type Messages = typeof en
const RAW: Record<string, unknown> = { en, 'es-AR': esAR, 'es-419': es419, 'pt-BR': ptBR }
const MERGED: Record<string, unknown> = {
    en,
    'es-419': deepMerge(en, es419 as DeepPartial<Messages>),
    'es-AR': deepMerge(deepMerge(en, es419 as DeepPartial<Messages>), esAR as DeepPartial<Messages>),
    'pt-BR': deepMerge(en, ptBR as DeepPartial<Messages>),
}

const KEYS = {
    common: ['continue', 'notNow', 'retry'],
    email: [
        'title',
        'desc',
        'label',
        'placeholder',
        'note',
        'invalid',
        'taken',
        'useOther',
        'recover',
        'saveFailed',
        'clearAria',
    ],
    notif: ['title', 'desc', 'cta', 'push1Title', 'push1Body', 'push2Title', 'push2Body', 'denied', 'openSettings'],
}
const REDESIGN_KEYS = Object.entries(KEYS).flatMap(([group, keys]) => keys.map((k) => `setupRedesign.${group}.${k}`))
const DEV_KEYS = [
    'setup.email.notReady',
    'setup.notifications.changeAnytime',
    'setup.notifications.saveFailed',
    'setup.notifications.importantLabel',
    'setup.notifications.importantDescription',
    'setup.notifications.offersLabel',
    'setup.notifications.offersDescription',
    'setup.notifications.emailLabel',
    'setup.notifications.emailDescription',
]

const at = (catalog: unknown, key: string) =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog)
const tags = (s: string) => [...s.matchAll(/<\/?([a-zA-Z]+)\s*\/?>/g)].map((m) => m[0]).sort()
const placeholders = (s: string) => [...s.matchAll(/\{\s*([a-zA-Z_]+)/g)].map((m) => m[1]).sort()

describe('P4-61 catalog parity for 09 Email and 10 Notifications', () => {
    it.each(Object.keys(RAW).filter((l) => l !== 'en'))(
        '%s has every key with en’s tags and placeholders',
        (locale) => {
            for (const key of REDESIGN_KEYS) {
                const source = at(en, key)
                const target = at(RAW[locale], key)
                expect({ key, type: typeof source }).toEqual({ key, type: 'string' })
                expect({ key, type: typeof target }).toEqual({ key, type: 'string' })
                expect({ key, tags: tags(target as string) }).toEqual({ key, tags: tags(source as string) })
                expect({ key, ph: placeholders(target as string) }).toEqual({ key, ph: placeholders(source as string) })
                expect((target as string).trim()).not.toBe('')
            }
        }
    )

    it.each(Object.keys(MERGED))('%s resolves every dev key the screens reuse', (locale) => {
        for (const key of DEV_KEYS)
            expect({ key, type: typeof at(MERGED[locale], key) }).toEqual({ key, type: 'string' })
    })

    it('openSettings is a single <link> tag in every locale', () => {
        for (const catalog of Object.values(RAW)) {
            expect(at(catalog, 'setupRedesign.notif.openSettings')).toMatch(/^<link>[^<]+<\/link>$/)
        }
    })
})
