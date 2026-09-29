import { APP_LOCALES, type AppLocale } from '../config'
import { deepMerge, type DeepPartial } from '../messages'
import en from '../messages/en.json'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import ptBR from '../messages/pt-BR.json'
import { leafValue } from './catalog-helpers'

/**
 * Money-surface copy consistency (mono: local/scratch/copy-glossary.md).
 *
 * Hugo opened the home Send drawer on staging and read, one row above the
 * other: "Link, Contacts, Bank, Crypto" and "Euro, Dollars, crypto and more".
 * Same drawer, two capitalizations of "crypto", a method in one row against a
 * currency in the other, and "and more" on only one of them. This pins the
 * three things that were wrong, so the next edit cannot put them back.
 *
 * Scope is the keys the copy pass normalised, not the whole catalog: other
 * surfaces still carry Title Case and still say KYC, and failing on those would
 * make this suite unreadable rather than useful.
 */

const CATALOGS: Record<AppLocale, Record<string, unknown>> = {
    en,
    'es-419': deepMerge(en, es419 as DeepPartial<typeof en>) as unknown as Record<string, unknown>,
    // es-AR is a delta on es-419 — resolve it the way loadMessages does
    'es-AR': deepMerge(
        deepMerge(en, es419 as DeepPartial<typeof en>),
        esAR as DeepPartial<typeof en>
    ) as unknown as Record<string, unknown>,
    'pt-BR': deepMerge(en, ptBR as DeepPartial<typeof en>) as unknown as Record<string, unknown>,
}

const read = (locale: AppLocale, path: string) => leafValue(CATALOGS[locale], path)

// ---------------------------------------------------------------- send drawer

const SEND_ROWS = ['home.drawers.sendToFriendsDescription', 'home.drawers.withdrawToOwnAccountsDescription'] as const

// the drawer names METHODS, so no row may name a currency instead
const CURRENCY = /(?<!\p{L})(EUR|USD|ARS|BRL|MXN|GBP|euros?|d[oó]llars?|d[oó]lares?|reais|real)(?!\p{L})/iu
// the method vocabulary both rows must share
const CRYPTO = /(?<!\p{L})cripto|crypto(?!\p{L})/iu
const AND_MORE = /(and more|y m[aá]s|e mais)\s*$/i

describe.each(APP_LOCALES)('home Send drawer subtitles (%s)', (locale) => {
    const rows = SEND_ROWS.map((path) => read(locale, path))

    it('names every option by the same dimension — methods, never a currency', () => {
        expect(rows.filter((row) => CURRENCY.test(row))).toEqual([])
        // positively pinned: both rows really do name the crypto method
        expect(rows.filter((row) => CRYPTO.test(row))).toHaveLength(rows.length)
    })

    it('uses "and more" in both rows or in neither', () => {
        const withMore = rows.filter((row) => AND_MORE.test(row))
        expect(withMore.length === 0 || withMore.length === rows.length).toBe(true)
    })

    it('uses one casing: sentence case in both rows', () => {
        const offenders: string[] = []
        for (const row of rows) {
            const words = row.split(/[\s,.]+/).filter(Boolean)
            if (!/^\p{Lu}/u.test(words[0])) offenders.push(`${row} — first word is not capitalized`)
            for (const word of words.slice(1)) {
                if (/^\p{Lu}/u.test(word) && !PROPER.has(word)) offenders.push(`${row} — "${word}"`)
            }
        }
        expect(offenders).toEqual([])
    })
})

// ------------------------------------------------------- normalised key set

/** Keys the copy pass put into sentence case. A Title Case word here is a regression. */
const SENTENCE_CASE_KEYS = [
    'home.drawers.sendToFriendsDescription',
    'home.drawers.withdrawToOwnAccountsDescription',
    'home.history.latestTransactions',
    'addMoney.title',
    'addMoney.crypto.title',
    'addMoney.crypto.depositAddress',
    'addMoney.crypto.universalDepositAddress',
    'addMoney.crypto.supportedNetworks',
    'addMoney.crypto.supportedTokens',
    'addMoney.networkDrawer.title',
    'addMoney.supportedNetworksModal.title',
    'addMoney.bankDetails.title',
    'addMoney.bankDetails.accountHolderName',
    'addMoney.bankDetails.accountNumber',
    'addMoney.bankDetails.routingNumber',
    'addMoney.bankDetails.sortCode',
    'addMoney.bankDetails.shareTitle',
    'withdraw.bank.accountOwner',
    'withdraw.bank.accountNumber',
    'withdraw.bank.bankAccount',
    'withdraw.bankForm.accountOwnerName',
    'payment.headers.confirmPayment',
    'payment.minAmount.title',
    'payment.requiresVerification',
    'transaction.drawerTitle',
    'transaction.name.bankAccount',
    'transaction.name.externalWallet',
    'transaction.name.peanutReward',
    'transaction.rows.accountNumber',
] as const

/** Capitals that survive sentence case: brands, rails, currency codes, acronyms. */
const PROPER = new Set([
    'Peanut',
    'Pix',
    'SEPA',
    'SPEI',
    'ACH',
    'FedNow',
    'Faster',
    'Payments',
    'Bre-B',
    'Mercado',
    'Pago',
    'Binance',
    'MetaMask',
    'Visa',
    'EUR',
    'USD',
    'ARS',
    'BRL',
    'MXN',
    'GBP',
    'IBAN',
    'BIC',
    'CLABE',
    'QR',
    'PDF',
    'EVM',
    'ENS',
    'USDC',
])

it('the normalised money-surface keys stay in sentence case', () => {
    const offenders: string[] = []
    for (const path of SENTENCE_CASE_KEYS) {
        const words = read('en', path).split(/\s+/).slice(1)
        for (const word of words) {
            const bare = word.replace(/^[^\p{L}]+|[^\p{L}-]+$/gu, '')
            if (!bare || !/^\p{Lu}/u.test(bare) || PROPER.has(bare)) continue
            offenders.push(`${path}: ${word}`)
        }
    }
    expect(offenders).toEqual([])
})

/** Terms retired from the money surfaces. Other surfaces still carry some of these. */
const RETIRED: Array<[string, RegExp, readonly string[]]> = [
    // `navigation.cashout` is an unreferenced key — left at its old value rather
    // than edited or deleted, so this rule skips that namespace.
    ['"withdraw", never "cash out"', /cash\s*out|cashout/i, ['withdraw', 'transaction.type']],
    ['"verification", never "KYC"', /(?<!\p{L})KYC(?!\p{L})/u, ['addMoney.methods']],
    ['"Pix", never "PIX"', /(?<!\p{L})PIX(?!\p{L})/u, ['addMoney.pix', 'withdraw.pixKey']],
    // Hugo, 2026-09-24: "account numbers" is retired from the money screens.
    [
        '"account", never "account numbers"',
        /account\s+numbers|números\s+de\s+(cuenta|conta)/i,
        ['depositAccounts.list', 'profile.unlockPayments'],
    ],
    // Hugo, 2026-09-25: the standing bank details are an "account"; "virtual"
    // was a technicality. No namespace keeps it.
    ['"account", never "virtual account"', /virtual\s+accounts?|cuentas?\s+virtual|contas?\s+virtua/i, Object.keys(en)],
]

describe.each(APP_LOCALES)('retired terms are gone from the fixed surfaces (%s)', (locale) => {
    it.each(RETIRED)('%s', (_name, pattern, prefixes) => {
        const offenders: string[] = []
        const walk = (node: unknown, path: string) => {
            if (typeof node === 'string') {
                if (pattern.test(node)) offenders.push(`${path}: ${node}`)
            } else if (node && typeof node === 'object') {
                for (const [key, child] of Object.entries(node)) walk(child, path ? `${path}.${key}` : key)
            }
        }
        for (const prefix of prefixes) walk(leafValue(CATALOGS[locale], prefix) ?? {}, prefix)
        expect(offenders).toEqual([])
    })
})
