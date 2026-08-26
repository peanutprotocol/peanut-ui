/*
 * Generates the marketing-site message catalogs.
 *
 * The landing page and the localized marketing pages reach only a handful of
 * namespaces, but AppIntlProvider used to ship the whole app catalog (129 KB of
 * KYC copy, bank-account forms, the token selector) to every route. These
 * subsets are what the marketing provider loads instead.
 *
 * Run via `pnpm generate:marketing-messages`; `marketing-messages.test.ts`
 * fails if the committed output drifts from the source catalogs.
 */
const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'app', 'messages')
const NAMESPACES = require(path.join(__dirname, '..', 'src', 'i18n', 'app', 'marketing-namespaces.json'))
const LOCALES = ['en', 'es-419', 'es-AR', 'pt-BR']

function subsetOf(catalog) {
    const out = {}
    for (const ns of NAMESPACES) {
        // non-English catalogs are partial by design (deepMerge fills the rest
        // from English), so a namespace missing here is expected, not an error
        if (ns in catalog) out[ns] = catalog[ns]
    }
    return out
}

function generate() {
    const written = []
    for (const locale of LOCALES) {
        const source = path.join(MESSAGES_DIR, `${locale}.json`)
        const target = path.join(MESSAGES_DIR, `${locale}.marketing.json`)
        const catalog = JSON.parse(fs.readFileSync(source, 'utf8'))
        written.push([target, JSON.stringify(subsetOf(catalog), null, 4) + '\n'])
    }
    return written
}

module.exports = { generate, subsetOf, NAMESPACES, LOCALES, MESSAGES_DIR }

if (require.main === module) {
    for (const [target, contents] of generate()) {
        fs.writeFileSync(target, contents)
        console.log(`wrote ${path.relative(process.cwd(), target)} (${(contents.length / 1024).toFixed(1)} KB)`)
    }
}
