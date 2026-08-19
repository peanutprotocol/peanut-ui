import { APP_LOCALES } from '../config'
import { deepMerge, type DeepPartial } from '../messages'
import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'
import marketingEs419 from '../../es-419.json'
import marketingEsAr from '../../es-ar.json'
import marketingPtBr from '../../pt-br.json'
import { leafEntries } from './catalog-helpers'

/**
 * Enforces the shared locale glossary (mono: content/_system/glossary/) on the
 * app catalogs — the deterministic subset: banned terms and wrong-register verb
 * forms. Register and word choice for content pages and app UI must not drift
 * apart; when the glossary changes, update these lists to match (TASK-21172).
 *
 * es-AR is checked RESOLVED (en ⊕ es-419 ⊕ delta, same as loadMessages) — a new
 * es-419 string with tuteo must get a voseo override before it reaches Argentine
 * users. es-419 and pt-BR are full catalogs, checked raw.
 *
 * Patterns use \s+ between words (NBSP from CAT tools still matches) and accept
 * accent-dropped variants where the unaccented form is not itself a legitimate
 * word in that locale.
 */

interface Rule {
    name: string
    pattern: RegExp
    // keys exempt from THIS rule only — e.g. strings quoting third-party UI verbatim
    exceptions?: string[]
}

// match whole words incl. accented letters; JS \b is ASCII-only
const word = (terms: string) => new RegExp(`(?<!\\p{L})(?:${terms})(?!\\p{L})`, 'iu')

// quotes Apple Wallet's own menu label ("Tarjeta/Cartão de débito o crédito")
const APPLE_WALLET_QUOTE = ['card.addToWallet.iosStep3']

// rules shared by every Spanish locale (glossary.es-419.md is the base layer)
const ES_COMMON: Rule[] = [
    { name: 'wallet is "billetera", never "monedero"', pattern: word('monederos?') },
    { name: 'usted is too formal for the app voice', pattern: word('usted') },
    { name: '"enviar dinero", never "transferir fondos"', pattern: word('transferir\\s+fondos') },
    {
        name: 'the card is "tarjeta virtual", never debit/prepaid',
        pattern: word('tarjeta\\s+(?:de\\s+d[eé]bito|prepaga)'),
        exceptions: APPLE_WALLET_QUOTE,
    },
]

const RULES: Record<Exclude<(typeof APP_LOCALES)[number], 'en'>, Rule[]> = {
    'es-419': [
        ...ES_COMMON,
        // pagás/enviá/pagá NOT accent-folded: "pagas"/"envia"/"paga" are legitimate tuteo forms
        {
            name: 'voseo is es-AR only',
            pattern: word('vos|pod[eé]s|ten[eé]s|envi[aá]s|pagás|enviá|pagá|cargá|tocá|fijate'),
        },
        { name: 'vosotros is es-ES only', pattern: word('vosotr[oa]s|podéis|tenéis|enviáis') },
        { name: '"computadora", never "ordenador" (Spain)', pattern: word('ordenador(?:es)?') },
        { name: '"tipo de cambio", never "tasa de cambio"', pattern: word('tasa\\s+de\\s+cambio') },
    ],
    'es-AR': [
        ...ES_COMMON,
        // "tú" not folded to "tu": the possessive "tu" is correct in voseo too.
        // "sáltate" not folded: "saltate" is the correct voseo imperative.
        { name: 'tú-forms sound foreign in es-AR (use voseo)', pattern: word('tú|puedes|tienes|env[ií]as|sáltate') },
        { name: '"dólar cripto", never "cripto dólar"', pattern: word('cripto\\s*d[oó]lar') },
    ],
    'pt-BR': [
        { name: '"celular", never "telemóvel" (Portugal)', pattern: word('telem[oó]ve(?:l|is)') },
        { name: '"dinheiro", never "grana" (too slangy)', pattern: word('grana') },
        { name: '"enviar dinheiro", never "transferir fundos"', pattern: word('transferir\\s+fundos') },
        { name: 'tu-conjugations are not pt-BR (use você)', pattern: word('tu\\s+(?:podes|tens|envias|pagas)') },
        {
            name: 'the card is "cartão virtual", never debit/prepaid',
            pattern: word('cart[aã]o\\s+(?:de\\s+d[eé]bito|pr[eé][-\\s]pago)'),
            exceptions: APPLE_WALLET_QUOTE,
        },
        { name: '"pular a lista", never "furar a fila"', pattern: word('furar\\s+a\\s+fila') },
        // stricter than glossary.pt-br.md (which allows one positively-framed body
        // use): app strings are short CTA-like copy — exempt per key if ever needed
        { name: '"sem CPF" framing is banned (trust rules)', pattern: word('sem\\s+CPF') },
        {
            name: 'no circumvention language (trust rules)',
            pattern: word('sem\\s+documentos|elimina\\s+essa\\s+barreira|sem\\s+verifica[cç][aã]o|sem\\s+burocracia'),
        },
    ],
}

// es-AR resolved exactly as loadMessages resolves it — the delta alone would
// hide tuteo leaking through the es-419 fallback
const CATALOGS: Record<keyof typeof RULES, Record<string, unknown>> = {
    'es-419': es419,
    'es-AR': deepMerge(deepMerge(en, es419 as DeepPartial<typeof en>), esAR as DeepPartial<typeof en>),
    'pt-BR': ptBR,
}

// The marketing catalogs (src/i18n/*.json) hold the landing copy, which is
// where the trust rules matter most — it is the first page a stranger sees.
// They were outside this suite until 18 Aug 2026, which is how "Pix sem CPF"
// shipped to peanut.me/pt-br and stayed green. These are full catalogs, not
// deltas, so they are checked raw.
const MARKETING_CATALOGS: Record<keyof typeof RULES, Record<string, unknown>> = {
    'es-419': marketingEs419,
    'es-AR': marketingEsAr,
    'pt-BR': marketingPtBr,
}

it('every non-en app locale has glossary rules', () => {
    const expected = APP_LOCALES.filter((locale) => locale !== 'en').sort()
    expect(Object.keys(RULES).sort()).toEqual(expected)
})

describe.each(Object.keys(RULES) as Array<keyof typeof RULES>)('%s glossary compliance', (locale) => {
    const entries = leafEntries(CATALOGS[locale])

    it.each(RULES[locale].map((rule) => [rule.name, rule] as const))('%s', (_name, rule) => {
        const violations = entries
            .filter(([path]) => !rule.exceptions?.includes(path))
            .filter(([, value]) => rule.pattern.test(value))
            .map(([path, value]) => `${path}: ${value}`)
        // fix the string, or — if it quotes third-party UI — add the key to the rule's exceptions
        expect(violations).toEqual([])
    })
})

describe.each(Object.keys(RULES) as Array<keyof typeof RULES>)('%s marketing glossary compliance', (locale) => {
    const entries = leafEntries(MARKETING_CATALOGS[locale])

    it.each(RULES[locale].map((rule) => [rule.name, rule] as const))('%s', (_name, rule) => {
        const violations = entries
            .filter(([path]) => !rule.exceptions?.includes(path))
            .filter(([, value]) => rule.pattern.test(value))
            .map(([path]) => path)
        expect(violations).toEqual([])
    })
})
