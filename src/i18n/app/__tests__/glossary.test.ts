import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'

/**
 * Enforces the shared locale glossary (mono: content/_system/glossary/) on the
 * app catalogs — the deterministic subset: banned terms and wrong-register verb
 * forms. Register and word choice for content pages and app UI must not drift
 * apart; when the glossary changes, update these lists to match (TASK-21172).
 *
 * Raw files are checked, not resolved catalogs: es-AR is a deltas-only overlay
 * and its es-419 fallback is correct by design (see loadMessages).
 */

// keys that quote third-party UI verbatim — exempt from glossary rules
const EXCEPTIONS: Record<string, string> = {
    'card.addToWallet.iosStep3': "quotes Apple Wallet's own menu label (Cartão/Tarjeta de débito ou crédito)",
}

interface Rule {
    name: string
    pattern: RegExp
}

// match whole words incl. accented letters; JS \b is ASCII-only
const word = (terms: string) => new RegExp(`(?<!\\p{L})(?:${terms})(?!\\p{L})`, 'iu')

const RULES: Record<'es-419' | 'es-AR' | 'pt-BR', Rule[]> = {
    'es-419': [
        { name: 'wallet is "billetera", never "monedero"', pattern: word('monederos?') },
        { name: 'voseo is es-AR only', pattern: word('vos|podés|tenés|enviás|pagás|enviá|pagá|cargá|tocá|fijate') },
        { name: 'vosotros is es-ES only', pattern: word('vosotr[oa]s|podéis|tenéis|enviáis') },
        { name: 'usted is too formal for the app voice', pattern: word('usted') },
        { name: '"computadora", never "ordenador" (Spain)', pattern: word('ordenador(?:es)?') },
        { name: '"tipo de cambio", never "tasa de cambio"', pattern: word('tasa de cambio') },
        { name: '"enviar dinero", never "transferir fondos"', pattern: word('transferir fondos') },
    ],
    'es-AR': [
        { name: 'wallet is "billetera", never "monedero"', pattern: word('monederos?') },
        { name: 'tú-forms sound foreign in es-AR (use voseo)', pattern: word('tú|puedes|tienes|envías|sáltate') },
        { name: 'usted is too formal for the app voice', pattern: word('usted') },
        { name: '"dólar cripto", never "cripto dólar"', pattern: word('cripto\\s*dólar') },
    ],
    'pt-BR': [
        { name: '"celular", never "telemóvel" (Portugal)', pattern: word('telemóve(?:l|is)') },
        { name: '"dinheiro", never "grana" (too slangy)', pattern: word('grana') },
        { name: '"enviar dinheiro", never "transferir fundos"', pattern: word('transferir fundos') },
        {
            name: 'the card is "cartão virtual", never debit/prepaid',
            pattern: word('cartão (?:de débito|pré[- ]pago)'),
        },
        { name: '"pular a lista", never "furar a fila"', pattern: word('furar a fila') },
        { name: '"sem CPF" framing is banned (trust rules)', pattern: word('sem CPF') },
    ],
}

const CATALOGS = { 'es-419': es419, 'es-AR': esAR, 'pt-BR': ptBR } as const

function leafEntries(obj: Record<string, unknown>, prefix = ''): Array<[string, string]> {
    return Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key
        return typeof value === 'object' && value !== null
            ? leafEntries(value as Record<string, unknown>, path)
            : [[path, String(value)] as [string, string]]
    })
}

describe.each(Object.keys(RULES) as Array<keyof typeof RULES>)('%s glossary compliance', (locale) => {
    const entries = leafEntries(CATALOGS[locale]).filter(([path]) => !(path in EXCEPTIONS))

    it.each(RULES[locale].map((rule) => [rule.name, rule] as const))('%s', (_name, rule) => {
        const violations = entries
            .filter(([, value]) => rule.pattern.test(value))
            .map(([path, value]) => `${path}: ${value}`)
        // fix the string, or — if it quotes third-party UI — add the key to EXCEPTIONS
        expect(violations).toEqual([])
    })
})
