import type { AppLocale } from '../config'
import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'
import { leafEntries } from './catalog-helpers'

type Catalog = Record<string, unknown>
type Translated = Exclude<AppLocale, 'en'>

const RAW: Record<Translated, Catalog> = { 'es-419': es419, 'es-AR': esAR, 'pt-BR': ptBR }
const TRANSLATED = Object.keys(RAW) as Translated[]

const EURC_KEYS = leafEntries(en)
    .map(([path]) => path)
    .filter((path) => path.startsWith('currencyAccounts.') || /eurc/i.test(path))

function lookup(catalog: Catalog, path: string): string | undefined {
    const value = path
        .split('.')
        .reduce<unknown>(
            (node, key) => (node && typeof node === 'object' ? (node as Catalog)[key] : undefined),
            catalog
        )
    return typeof value === 'string' ? value : undefined
}

// es-AR is a deltas-only overlay: a key it does not hold inherits es-419.
function resolve(locale: Translated, path: string, catalogs: Record<Translated, Catalog> = RAW) {
    return locale === 'es-AR'
        ? (lookup(catalogs['es-AR'], path) ?? lookup(catalogs['es-419'], path))
        : lookup(catalogs[locale], path)
}

/** Argument names of an ICU message, including those nested in plural/select branches. */
function icuArguments(message: string): string[] {
    const names = new Set<string>()
    let i = 0
    const take = (pattern: RegExp) => {
        const match = pattern.exec(message.slice(i))
        if (match) i += match[0].length
        return match
    }
    const text = (nested: boolean) => {
        while (i < message.length) {
            const char = message[i]
            if (char === "'" && message[i + 1] === "'") i += 2
            else if (char === "'" && /[{}#|]/.test(message[i + 1] ?? '')) {
                const end = message.indexOf("'", i + 1)
                i = end === -1 ? message.length : end + 1
            } else if (char === '}' && nested) return
            else if (char === '{') {
                i++
                argument()
            } else i++
        }
    }
    const argument = () => {
        const head = take(/^\s*([^\s,{}]+)\s*([,}])/)
        if (!head) return
        names.add(head[1])
        if (head[2] === '}') return
        const type = take(/^\s*(\w+)\s*([,}])/)
        if (!type || type[2] === '}') return
        if (!['plural', 'select', 'selectordinal'].includes(type[1])) {
            take(/^[^}]*\}/)
            return
        }
        take(/^\s*offset:\s*\d+/)
        while (take(/^\s*[^\s{}]+\s*\{/)) {
            text(true)
            i++
        }
        take(/^\s*\}/)
    }
    text(false)
    return [...names].sort()
}

function argumentMismatches(catalogs: Record<Translated, Catalog>, locale: Translated) {
    return EURC_KEYS.flatMap((path) => {
        const expected = icuArguments(lookup(en, path)!)
        const message = resolve(locale, path, catalogs)
        const actual = message === undefined ? null : icuArguments(message)
        return JSON.stringify(actual) === JSON.stringify(expected) ? [] : [{ path, expected, actual }]
    })
}

it('covers the EURC account copy and the EURC deletion refusal', () => {
    expect(EURC_KEYS).toEqual(
        expect.arrayContaining([
            'currencyAccounts.convertedTotalBalance',
            'currencyAccounts.sendCurrencyBalance',
            'settings.deleteAccount.blockedEurcDescription',
        ])
    )
    expect(icuArguments(en.currencyAccounts.convertedTotalBalance)).toEqual(['amount', 'currency'])
})

it.each(TRANSLATED)('translates every EURC key in %s', (locale) => {
    const untranslated = EURC_KEYS.filter((path) => {
        const message = resolve(locale, path)
        return message === undefined || message.trim() === '' || message === lookup(en, path)
    })
    expect(untranslated).toEqual([])
})

it.each(TRANSLATED)('keeps every ICU argument of the English EURC copy in %s', (locale) => {
    expect(argumentMismatches(RAW, locale)).toEqual([])
})

it.each(TRANSLATED)('reports a {currency} argument dropped from the %s copy', (locale) => {
    const broken = JSON.parse(JSON.stringify(RAW)) as Record<Translated, Catalog>
    const inherits = locale === 'es-AR' && lookup(esAR, 'currencyAccounts.convertedTotalBalance') === undefined
    const owner = (inherits ? broken['es-419'] : broken[locale]) as { currencyAccounts: Record<string, string> }
    owner.currencyAccounts.convertedTotalBalance = owner.currencyAccounts.convertedTotalBalance.replace(
        '{currency}',
        ''
    )

    expect(argumentMismatches(broken, locale)).toEqual([
        { path: 'currencyAccounts.convertedTotalBalance', expected: ['amount', 'currency'], actual: ['amount'] },
    ])
})

it('reads arguments nested in plural and select branches', () => {
    expect(icuArguments("{count, plural, one {# {asset}} other {# '{assets}' {name}}}")).toEqual([
        'asset',
        'count',
        'name',
    ])
    expect(icuArguments('{kind, select, eurc {EURC} other {{currency}}}')).toEqual(['currency', 'kind'])
})

it('holds only es-AR deltas over es-419 in the EURC copy', () => {
    const duplicated = EURC_KEYS.filter((path) => {
        const own = lookup(esAR, path)
        return own !== undefined && own === lookup(es419, path)
    })
    expect(duplicated).toEqual([])
})
