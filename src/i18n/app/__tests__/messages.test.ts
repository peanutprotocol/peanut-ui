import { createTranslator } from 'next-intl'
import { APP_LOCALES, type AppLocale } from '../config'
import { deepMerge, loadMessages } from '../messages'
import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'
import { leafPaths, leafValue } from './catalog-helpers'

const CATALOGS = { en, 'es-419': es419, 'es-AR': esAR, 'pt-BR': ptBR } as const

// es-AR is a deltas-only overlay on es-419 (see loadMessages), so its raw file
// holds a subset of the en key set rather than all of it.
const DELTA_LOCALES: readonly AppLocale[] = ['es-AR']
const FULL_LOCALES = APP_LOCALES.filter((locale) => !DELTA_LOCALES.includes(locale))

/**
 * English strings that legitimately carry more than one translation. Spanish and
 * Portuguese make distinctions English collapses, so these keys must NOT be merged
 * into one — doing so ships the wrong part of speech or the wrong gender.
 */
const CONTEXT_DIVERGENT: Record<string, string> = {
    Send: 'nav/action verb vs. transaction-type noun (Enviar / Envío)',
    Request: 'nav/action verb vs. transaction-type noun (Solicitar / Solicitud)',
    Add: 'nav verb vs. transaction-type noun (Agregar / Ingreso)',
    Withdraw: 'nav verb vs. transaction-type noun (Retirar / Retiro)',
    Pay: 'nav/action verb vs. transaction-type noun (Pagar / Pago)',
    Claim: 'nav verb vs. transaction-type noun (Reclamar / Reclamo)',
    Receive: 'action verb vs. transaction-type noun (Recibir / Recepción)',
    Join: 'standalone CTA vs. sentence fragment completed by a team name',
    Processing: 'generic in-flight status vs. KYC under-review status (En proceso)',
    Failed: 'generic status vs. KYC status agreeing with "verificación" (Fallido / Fallida)',
    Verified: 'badge/KYC status vs. residence chip agreeing with "residencia" (Verificado / Verificada)',
    'Settings → Passwords → Search "Peanut"': 'iOS and Android name the settings app differently',
    Username: 'signup handles and recipient/profile labels need different regional wording',
    'Mexican peso bank transfers': 'sentence fragment vs. standalone label casing',
    'US dollar bank transfers': 'sentence fragment vs. standalone label casing',
    'Euro bank transfers': 'sentence fragment vs. standalone label casing',
    'British pound bank transfers': 'sentence fragment vs. standalone label casing',
}

describe('deepMerge fallback', () => {
    it('fills keys missing from a locale catalog with English', async () => {
        const partial = { common: { cancel: 'Cancelar' } }
        const merged = deepMerge(en, partial)
        expect(merged.common.cancel).toBe('Cancelar')
        expect(merged.common.continue).toBe(en.common.continue)
        expect(merged.loadingStates).toEqual(en.loadingStates)
    })

    it('loadMessages returns complete catalogs for every locale', async () => {
        const enPaths = leafPaths(en).sort()
        for (const locale of APP_LOCALES) {
            const messages = await loadMessages(locale)
            expect(leafPaths(messages as unknown as Record<string, unknown>).sort()).toEqual(enPaths)
        }
    })

    it('es-AR inherits es-419 for keys it does not override', async () => {
        const messages = await loadMessages('es-AR')
        expect(messages.common.cancel).toBe(es419.common.cancel)
    })
})

describe('catalog key parity', () => {
    const enPaths = leafPaths(en).sort()
    it.each(FULL_LOCALES)('%s has exactly the en key set', (locale) => {
        expect(leafPaths(CATALOGS[locale]).sort()).toEqual(enPaths)
    })

    it.each(DELTA_LOCALES)('%s holds only keys that exist in en', (locale) => {
        const stray = leafPaths(CATALOGS[locale]).filter((path) => !enPaths.includes(path))
        expect(stray).toEqual([])
    })
})

describe('navigation action labels', () => {
    const EXPECTED_ACTIONS: Record<AppLocale, { request: string; add: string }> = {
        en: { request: 'Request', add: 'Add' },
        'es-419': { request: 'Solicitar', add: 'Agregar' },
        'es-AR': { request: 'Solicitar', add: 'Agregar' },
        'pt-BR': { request: 'Cobrar', add: 'Adicionar' },
    }

    it.each(APP_LOCALES)('%s keeps request and add distinct', async (locale) => {
        const { navigation } = await loadMessages(locale)
        expect({ request: navigation.request, add: navigation.add }).toEqual(EXPECTED_ACTIONS[locale])
        expect(navigation.request).not.toBe(navigation.add)
    })
})

describe('deposit screen copy', () => {
    const EXPECTED = {
        en: {
            howToDeposit: 'How to deposit',
            supportedNetworks: 'Supported networks',
            supportedTokens: 'Supported tokens',
            bridgingNote:
                'USDC on Arbitrum arrives at the full amount. Deposits from other chains or tokens are bridged and can vary slightly (±0.1%).',
        },
        'es-419': {
            howToDeposit: 'Cómo depositar',
            supportedNetworks: 'Redes compatibles',
            supportedTokens: 'Tokens compatibles',
            bridgingNote:
                'Los depósitos de USDC en Arbitrum se acreditan por el monto total. Los depósitos desde otras redes o tokens se puentean y pueden variar un poco (±0.1%).',
        },
        'es-AR': {
            howToDeposit: 'Cómo depositar',
            supportedNetworks: 'Redes compatibles',
            supportedTokens: 'Tokens compatibles',
            bridgingNote:
                'Los depósitos de USDC en Arbitrum se acreditan por el monto total. Los depósitos desde otras redes o tokens se puentean y pueden variar un poco (±0.1%).',
        },
        'pt-BR': {
            howToDeposit: 'Como depositar',
            supportedNetworks: 'Redes compatíveis',
            supportedTokens: 'Tokens compatíveis',
            bridgingNote:
                'Depósitos de USDC na Arbitrum são creditados pelo valor total. Depósitos de outras redes ou tokens passam por ponte e podem variar um pouco (±0,1%).',
        },
    } satisfies Record<
        AppLocale,
        { howToDeposit: string; supportedNetworks: string; supportedTokens: string; bridgingNote: string }
    >

    it.each(APP_LOCALES)('%s uses the approved localized copy', async (locale) => {
        const { addMoney } = await loadMessages(locale)

        expect({
            howToDeposit: addMoney.howToDeposit.title,
            supportedNetworks: addMoney.crypto.supportedNetworks,
            supportedTokens: addMoney.crypto.supportedTokens,
            bridgingNote: addMoney.crypto.bridgingVarianceNoteEvm,
        }).toEqual(EXPECTED[locale])
    })
})

describe('duplicate-value drift', () => {
    const groups = new Map<string, string[]>()
    for (const path of leafPaths(en)) {
        const value = leafValue(en, path)
        groups.set(value, [...(groups.get(value) ?? []), path])
    }
    const duplicated = [...groups.entries()].filter(
        ([value, paths]) => paths.length > 1 && !(value in CONTEXT_DIVERGENT)
    )

    // Resolved catalogs, not raw files — es-AR is a delta, so a partial override
    // of a duplicate group only shows up once es-419 has been merged underneath.
    it.each(APP_LOCALES.filter((locale) => locale !== 'en'))(
        'keys sharing an English string share the same %s translation',
        async (locale) => {
            const messages = (await loadMessages(locale)) as unknown as Record<string, unknown>
            const drifted = duplicated
                .map(([value, paths]) => ({
                    value,
                    renderings: [...new Set(paths.map((path) => leafValue(messages, path)))],
                    paths,
                }))
                .filter(({ renderings }) => renderings.length > 1)

            // Either collapse the keys onto one canonical key, or — if the strings
            // genuinely differ by context — add the English to CONTEXT_DIVERGENT.
            expect(drifted).toEqual([])
        }
    )
})

describe('ICU message compilation', () => {
    it.each(APP_LOCALES)('every %s message compiles and formats', (locale) => {
        const messages = CATALOGS[locale]
        const invalid: string[] = []
        const t = createTranslator({
            locale,
            messages,
            onError: (error) => {
                // formatting errors from our dummy values are fine; a message
                // that fails to PARSE (e.g. unescaped ICU apostrophe) is not
                if (error.code === 'INVALID_MESSAGE') invalid.push(error.message)
            },
            getMessageFallback: ({ key }) => key,
        })
        // `date` is bound to a Date; a new `{date}` key expecting a preformatted
        // string will format-error (ignored above) — name such params differently.
        const dummy = {
            count: 2,
            amount: '10',
            name: 'Ana',
            username: 'ana',
            value: '1',
            date: new Date(0),
            days: 3,
            minutes: 2,
        }
        for (const path of leafPaths(messages)) {
            t(path as any, dummy)
        }
        expect(invalid).toEqual([])
    })
})

describe('badge invite requirement agreement', () => {
    const EXPECTED = {
        en: ['Invite 1 friend who joins Peanut.', 'Invite 2 friends who join Peanut.'],
        'es-419': ['Invita a 1 amigo que se una a Peanut.', 'Invita a 2 amigos que se unan a Peanut.'],
        'es-AR': ['Invita a 1 amigo que se una a Peanut.', 'Invita a 2 amigos que se unan a Peanut.'],
        'pt-BR': ['Convide 1 amigo que entre no Peanut.', 'Convide 2 amigos que entrem no Peanut.'],
    } satisfies Record<AppLocale, [string, string]>

    it.each(APP_LOCALES)('%s uses singular and plural relative verbs', async (locale) => {
        const messages = await loadMessages(locale)
        const t = createTranslator({ locale, messages, namespace: 'badges' })

        expect([t('unlock.invites', { target: 1 }), t('unlock.invites', { target: 2 })]).toEqual(EXPECTED[locale])
    })
})

describe('badge avatar benefit agreement', () => {
    const EXPECTED = {
        en: ['1 avatar for your profile', '3 avatars for your profile'],
        'es-419': ['1 avatar para tu perfil', '3 avatares para tu perfil'],
        'es-AR': ['1 avatar para tu perfil', '3 avatares para tu perfil'],
        'pt-BR': ['1 avatar para o seu perfil', '3 avatares para o seu perfil'],
    } satisfies Record<AppLocale, [string, string]>

    it.each(APP_LOCALES)('%s agrees the avatar count with its noun', async (locale) => {
        const messages = await loadMessages(locale)
        const t = createTranslator({ locale, messages, namespace: 'badges' })

        expect([t('benefit.avatars', { count: 1 }), t('benefit.avatars', { count: 3 })]).toEqual(EXPECTED[locale])
    })
})

// TASK-22143: the ENS badge reached production with no `badges.catalog` entry, so
// `useBadgeCopy` fell back to the backend's English name and the Spanish and
// Portuguese Badges screens rendered "Name Dropper" in the middle of translated
// copy. Key parity alone would not have caught it — the key was absent from every
// locale, en included — so pin the localized names against English directly.
describe('ENS badge copy is localized', () => {
    it.each(APP_LOCALES.filter((locale) => locale !== 'en'))('%s translates the ENS badge', async (locale) => {
        const messages = await loadMessages(locale)
        expect(messages.badges.catalog.ENS.name).not.toBe(en.badges.catalog.ENS.name)
        expect(messages.badges.catalog.ENS.description).not.toBe(en.badges.catalog.ENS.description)
    })
})
