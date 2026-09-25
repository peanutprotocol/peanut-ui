// i18n length drift: compares the visible length of each translated app
// message with its English source. The CLI (i18n-length-drift.mjs) owns flags
// and output; this module only reads catalogs and measures, so the jest test
// can drive it on a fixture tree.
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const { closingBrace, flattenCatalog } = require('./screen-wordiness-core.cjs')

const MESSAGES_DIR = 'src/i18n/app/messages'
const ALLOWLIST_PATH = 'scripts/i18n-length-drift-allowlist.json'
const LOCALES = ['es-419', 'es-AR', 'pt-BR']
// es-AR holds only the keys where Argentine Spanish differs; the rest comes
// from es-419 (same layering as src/i18n/app/messages.ts).
const PARENT_LOCALE = { 'es-AR': 'es-419' }

const DEFAULTS = {
    threshold: 0.3,
    // Below this, one or two characters already exceed 30%.
    minEnChars: 8,
    // English strings shorter than this are headings, buttons or row labels.
    titleMaxChars: 40,
}
const TITLE_KEY_RE = /(title|heading|label|cta)$/i

/**
 * The text a reader sees for one ICU message: `{arg}` placeholders and rich
 * text tags are dropped, and a plural or select keeps its longest branch.
 */
function visibleText(msg) {
    if (typeof msg !== 'string') return ''
    let text = ''
    let i = 0
    while (i < msg.length) {
        const ch = msg[i]
        if (ch !== '{') {
            text += ch
            i++
            continue
        }
        const end = closingBrace(msg, i)
        const parts = msg.slice(i + 1, end).split(',')
        i = end + 1
        const kind = (parts[1] ?? '').trim()
        if (kind !== 'plural' && kind !== 'select' && kind !== 'selectordinal') continue
        const body = parts.slice(2).join(',')
        let longest = ''
        let j = 0
        while (j < body.length) {
            const open = body.indexOf('{', j)
            if (open === -1) break
            const close = closingBrace(body, open)
            const branch = visibleText(body.slice(open + 1, close).replace(/#/g, ''))
            if (branch.length > longest.length) longest = branch
            j = close + 1
        }
        text += longest
    }
    return text
        .replace(/<\/?[a-zA-Z][^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

const charCount = (text) => [...text].length

function readCatalog(root, locale) {
    const file = join(root, MESSAGES_DIR, `${locale}.json`)
    return existsSync(file) ? flattenCatalog(JSON.parse(readFileSync(file, 'utf8'))) : new Map()
}

/** Allowlist entries: `{ key, locale?, reason }`. No `locale` means every locale. */
function readAllowlist(root) {
    const file = join(root, ALLOWLIST_PATH)
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
}

const allowlistIndex = (allowlist, locale, key) =>
    allowlist.findIndex((e) => e.key === key && (e.locale === undefined || e.locale === locale))

/**
 * Every translated key per locale, with the keys whose visible length differs
 * from English by more than the threshold. A key missing from a locale renders
 * English, so it is not compared.
 */
function measureDrift(root, options = {}) {
    const { threshold, minEnChars, titleMaxChars } = { ...DEFAULTS, ...options }
    const en = readCatalog(root, 'en')
    const allowlist = readAllowlist(root)
    const own = Object.fromEntries(LOCALES.map((l) => [l, readCatalog(root, l)]))
    const usedAllowlist = new Set()

    const locales = LOCALES.map((locale) => {
        const parent = PARENT_LOCALE[locale]
        let compared = 0
        let allowlisted = 0
        const flagged = []
        for (const [key, enMsg] of en) {
            const inherited = !own[locale].has(key) && parent !== undefined && own[parent].has(key)
            const msg = own[locale].has(key) ? own[locale].get(key) : inherited ? own[parent].get(key) : undefined
            if (typeof msg !== 'string' || typeof enMsg !== 'string') continue
            const enText = visibleText(enMsg)
            const enChars = charCount(enText)
            if (enChars < minEnChars) continue
            compared++
            const text = visibleText(msg)
            const chars = charCount(text)
            const drift = (chars - enChars) / enChars
            if (Math.abs(drift) <= threshold) continue
            const allowed = allowlistIndex(allowlist, locale, key)
            if (allowed !== -1) {
                allowlisted++
                usedAllowlist.add(allowed)
                continue
            }
            const lastSegment = key.slice(key.lastIndexOf('.') + 1)
            // Raw messages for the report: a reader recognises `{name}` faster than a gap.
            flagged.push({
                key,
                en: enMsg,
                text: msg,
                enChars,
                chars,
                drift,
                title: TITLE_KEY_RE.test(lastSegment) || enChars < titleMaxChars,
                inherited,
            })
        }
        flagged.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift) || b.enChars - a.enChars)
        return { locale, compared, allowlisted, flagged }
    })

    const staleAllowlist = allowlist.filter((_, i) => !usedAllowlist.has(i))
    const missingReason = allowlist.filter((e) => typeof e.reason !== 'string' || !e.reason.trim())
    return { threshold, locales, staleAllowlist, missingReason }
}

module.exports = { visibleText, measureDrift, LOCALES, ALLOWLIST_PATH }
