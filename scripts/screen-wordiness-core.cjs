// Screen wordiness: static count of the English copy each screen can show.
// The CLI (screen-wordiness.mjs) owns flags, baseline and output; this module
// only reads files and counts, so the jest test can drive it on a fixture tree.
// Counting rules: scripts/screen-wordiness.md.
const ts = require('typescript')
const { readdirSync, readFileSync, existsSync, statSync } = require('node:fs')
const { join, relative, dirname, basename } = require('node:path')

// Routes outside the app's own mobile UI. Same boundary as the screen
// library inventory (scripts/screens/inventory.mjs).
const EXCLUDED_ROUTE_PREFIXES = [
    'app/dev/',
    'app/(mobile-ui)/dev/',
    'app/[locale]/',
    'app/es-419/',
    'app/es-ar/',
    'app/pt-br/',
    'app/lp/',
    'app/careers/',
    'app/m/',
    'app/app/',
    'app/shhhhh/',
    'app/crisp-proxy/',
    'app/(mobile-ui)/quests/',
    'app/api/',
]
const EXCLUDED_ROUTE_FILES = ['app/page.tsx']

// Component trees that are never app screens (marketing site, dev tooling,
// image generation).
const EXCLUDED_COMPONENT_DIRS = [
    'components/LandingPage/',
    'components/Marketing/',
    'components/og/',
    'app/dev/',
    'app/(mobile-ui)/dev/',
    'features/payment-network-explorer/',
]

// Design-system primitives and shared chrome. Their words arrive as props
// from the screen that renders them, so they are counted there, not here.
const SHARED_DIRS = ['components/0_Bruddle/', 'components/Global/']

const SCREEN_COMPONENT_RE = /(Screen|View|\.view|Modal|Drawer|Sheet)\.tsx$/
const TRANSLATOR_FACTORIES = new Set(['useTranslations', 'useAppTranslations', 'getTranslations'])
const CALLOUT_TAGS = new Set(['Callout'])
const CALLOUT_WEIGHT = 2
// String props that render as text. Everything else (className, href, testid) is not copy.
const VISIBLE_PROPS = new Set([
    'title',
    'subtitle',
    'description',
    'label',
    'placeholder',
    'text',
    'message',
    'heading',
    'helperText',
    'ctaLabel',
])

// ---------------------------------------------------------------- messages

const WORD_RE = /[\p{L}\p{N}]/u

function countPlainWords(text) {
    return text
        .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
        .split(/\s+/)
        .filter((w) => WORD_RE.test(w)).length
}

/** Index of the `}` that closes the `{` at `open`. */
function closingBrace(msg, open) {
    let depth = 0
    for (let i = open; i < msg.length; i++) {
        if (msg[i] === '{') depth++
        else if (msg[i] === '}' && --depth === 0) return i
    }
    return msg.length - 1
}

/**
 * Words a reader sees for one ICU message. `{arg}` renders one word. A plural
 * or select renders one branch, so only the longest branch counts.
 */
function countMessageWords(msg) {
    if (typeof msg !== 'string') return 0
    let words = 0
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
        const inner = msg.slice(i + 1, end)
        i = end + 1
        const parts = inner.split(',')
        const kind = (parts[1] ?? '').trim()
        if (kind === 'plural' || kind === 'select' || kind === 'selectordinal') {
            let body = parts.slice(2).join(',')
            let longest = 0
            let j = 0
            while (j < body.length) {
                const open = body.indexOf('{', j)
                if (open === -1) break
                const close = closingBrace(body, open)
                longest = Math.max(longest, countMessageWords(body.slice(open + 1, close).replace(/#/g, ' 0 ')))
                j = close + 1
            }
            words += longest
        } else {
            text += ' x '
        }
    }
    return words + countPlainWords(text)
}

function flattenCatalog(obj, prefix = '', into = new Map()) {
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k
        if (v && typeof v === 'object' && !Array.isArray(v)) flattenCatalog(v, key, into)
        else into.set(key, Array.isArray(v) ? v.join(' ') : v)
    }
    return into
}

function loadCatalog(root) {
    const raw = JSON.parse(readFileSync(join(root, 'src/i18n/app/messages/en.json'), 'utf8'))
    const flat = flattenCatalog(raw)
    const words = new Map()
    for (const [k, v] of flat) words.set(k, countMessageWords(v))
    return words
}

// ---------------------------------------------------------------- files

function walk(dir) {
    if (!existsSync(dir)) return []
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name)
        if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : walk(p)
        return /\.tsx?$/.test(e.name) && !/\.(test|spec|stories)\.tsx?$/.test(e.name) ? [p] : []
    })
}

const srcRel = (root, file) => relative(join(root, 'src'), file)

function isScreenRoot(rel) {
    if (EXCLUDED_COMPONENT_DIRS.some((d) => rel.startsWith(d))) return false
    if (rel.startsWith('app/') && basename(rel) === 'page.tsx') {
        return !EXCLUDED_ROUTE_FILES.includes(rel) && !EXCLUDED_ROUTE_PREFIXES.some((p) => rel.startsWith(p))
    }
    return SCREEN_COMPONENT_RE.test(rel) && !SHARED_DIRS.some((d) => rel.startsWith(d))
}

function resolveImport(root, fromFile, spec) {
    let base
    if (spec.startsWith('@/')) base = join(root, 'src', spec.slice(2))
    else if (spec.startsWith('.')) base = join(dirname(fromFile), spec)
    else return null
    for (const cand of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
        if (existsSync(cand) && statSync(cand).isFile()) return cand
    }
    return null
}

// ---------------------------------------------------------------- per-file analysis

const stringOf = (node) => (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null)

function tagName(node) {
    const t = node.tagName
    if (ts.isIdentifier(t)) return t.text
    if (ts.isPropertyAccessExpression(t)) return t.name.text
    return ''
}

/** The namespace a translator factory call binds: `useTranslations('ns')`, `getTranslations({ namespace })`. */
function factoryNamespace(call) {
    const arg = call.arguments[0]
    if (!arg) return ''
    const s = stringOf(arg)
    if (s !== null) return s
    if (ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
            if (ts.isPropertyAssignment(p) && p.name.getText() === 'namespace') return stringOf(p.initializer)
        }
        return ''
    }
    return null // getTranslations(locale): the marketing catalog, not this one
}

function unwrapAwait(expr) {
    while (expr && (ts.isAwaitExpression(expr) || ts.isParenthesizedExpression(expr))) expr = expr.expression
    return expr
}

function calleeText(call) {
    const c = call.expression
    return ts.isIdentifier(c) ? c.text : null
}

/**
 * Key alternatives for a translator call's first argument. A template literal
 * becomes a pattern; a ternary or `??` yields each side.
 */
function keyAlternatives(node) {
    node = unwrapAwait(node)
    if (!node) return []
    const s = stringOf(node)
    if (s !== null) return [{ literal: s }]
    if (ts.isTemplateExpression(node)) {
        const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        let re = esc(node.head.text)
        for (const span of node.templateSpans) re += '[^.]+' + esc(span.literal.text)
        return [{ pattern: re }]
    }
    if (ts.isConditionalExpression(node)) return [...keyAlternatives(node.whenTrue), ...keyAlternatives(node.whenFalse)]
    if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
            node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
        return [...keyAlternatives(node.left), ...keyAlternatives(node.right)]
    }
    return []
}

function parse(file) {
    return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/**
 * A translator factory call as `{ ns, ios }`, or null when it reads another
 * catalog. `ios` marks useAppTranslations, which renders `<ns>.iosCopy.<key>`
 * instead of `<ns>.<key>` on iOS when that override exists.
 */
function translatorOf(call) {
    const ns = factoryNamespace(call)
    return ns === null ? null : { ns, ios: calleeText(call) === 'useAppTranslations' }
}

/** The one translator a hook module binds, if it binds exactly one. */
function hookModuleTranslator(ctx, file) {
    if (ctx.hookNs.has(file)) return ctx.hookNs.get(file)
    const found = new Map()
    const visit = (n) => {
        if (ts.isCallExpression(n) && TRANSLATOR_FACTORIES.has(calleeText(n))) {
            const tr = translatorOf(n)
            if (tr) found.set(`${tr.ns}|${tr.ios}`, tr)
        }
        ts.forEachChild(n, visit)
    }
    visit(parse(file))
    const tr = found.size === 1 ? [...found.values()][0] : undefined
    ctx.hookNs.set(file, tr)
    return tr
}

/**
 * Everything one file contributes: translator key uses, literal JSX text,
 * callout count, local .tsx imports to follow.
 */
function analyzeFile(ctx, file) {
    if (ctx.files.has(file)) return ctx.files.get(file)
    const sf = parse(file)
    const importsByName = new Map() // local name -> resolved file
    const imports = []
    for (const st of sf.statements) {
        if (!ts.isImportDeclaration(st) || st.importClause?.isTypeOnly) continue
        const target = resolveImport(ctx.root, file, st.moduleSpecifier.text)
        if (!target) continue
        imports.push(target)
        const cl = st.importClause
        if (cl?.name) importsByName.set(cl.name.text, target)
        if (cl?.namedBindings && ts.isNamedImports(cl.namedBindings)) {
            for (const el of cl.namedBindings.elements) importsByName.set(el.name.text, target)
        }
    }

    // translator name -> { ns ('' = root), ios }. A file-wide map: the same
    // name bound to two namespaces in one file is rare, and the later wins.
    const translators = new Map()
    const bindFrom = (nameNode, init) => {
        init = unwrapAwait(init)
        if (!init || !ts.isCallExpression(init)) return
        const callee = calleeText(init)
        let tr
        if (TRANSLATOR_FACTORIES.has(callee)) tr = translatorOf(init)
        else if (callee && /^use[A-Z]/.test(callee) && importsByName.has(callee)) {
            tr = hookModuleTranslator(ctx, importsByName.get(callee))
        }
        if (!tr) return
        if (ts.isIdentifier(nameNode)) translators.set(nameNode.text, tr)
        else if (ts.isObjectBindingPattern(nameNode)) {
            for (const el of nameNode.elements) {
                const prop = el.propertyName ? el.propertyName.getText() : el.name.getText()
                if (prop === 't' && ts.isIdentifier(el.name)) translators.set(el.name.text, tr)
            }
        }
    }
    const collectBindings = (n) => {
        if (ts.isVariableDeclaration(n)) bindFrom(n.name, n.initializer)
        ts.forEachChild(n, collectBindings)
    }
    collectBindings(sf)

    const keyUses = [] // { ns, ios, alts, weight }
    let literalWords = 0
    let callouts = 0
    const visit = (n, weight) => {
        if (
            (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) &&
            CALLOUT_TAGS.has(tagName(ts.isJsxElement(n) ? n.openingElement : n))
        ) {
            callouts++
            weight = CALLOUT_WEIGHT
        }
        if (ts.isCallExpression(n)) {
            const c = n.expression
            let name = null
            if (ts.isIdentifier(c)) name = c.text
            else if (
                ts.isPropertyAccessExpression(c) &&
                ts.isIdentifier(c.expression) &&
                ['rich', 'markup'].includes(c.name.text)
            ) {
                name = c.expression.text
            }
            if (name && n.arguments.length) {
                if (translators.has(name)) {
                    const { ns, ios } = translators.get(name)
                    keyUses.push({ ns, ios, alts: keyAlternatives(n.arguments[0]), weight })
                } else if (/^t([A-Z]\w*)?$/.test(name)) {
                    // a translator passed in as a prop: namespace unknown here
                    keyUses.push({ ns: undefined, ios: false, alts: keyAlternatives(n.arguments[0]), weight })
                }
            }
        }
        if (ts.isJsxText(n)) literalWords += countPlainWords(n.text) * weight
        if (ts.isJsxExpression(n) && n.expression && ts.isJsxElement(n.parent) && stringOf(n.expression) !== null) {
            literalWords += countPlainWords(stringOf(n.expression)) * weight
        }
        if (ts.isJsxAttribute(n) && n.initializer && VISIBLE_PROPS.has(n.name.getText())) {
            const init = n.initializer
            const s = ts.isStringLiteral(init)
                ? init.text
                : ts.isJsxExpression(init) && init.expression
                  ? stringOf(init.expression)
                  : null
            if (s !== null) literalWords += countPlainWords(s) * weight
        }
        ts.forEachChild(n, (child) => visit(child, weight))
    }
    visit(sf, 1)

    const result = { imports, keyUses, literalWords, callouts }
    ctx.files.set(file, result)
    return result
}

/** `rewards.title` -> `rewards.iosCopy.title` for a translator bound to `rewards`. */
function iosOverrideKey(ns, key) {
    if (!ns) return `iosCopy.${key}`
    return key.startsWith(`${ns}.`) ? `${ns}.iosCopy.${key.slice(ns.length + 1)}` : null
}

/** Resolve one key use to { key, words }: the heaviest alternative, or null. */
function resolveKeyUse(ctx, use) {
    let best = null
    for (const alt of use.alts) {
        let candidates
        if (alt.literal !== undefined) {
            if (use.ns !== undefined) candidates = [use.ns ? `${use.ns}.${alt.literal}` : alt.literal]
            else candidates = ctx.catalog.has(alt.literal) ? [alt.literal] : (ctx.suffixIndex.get(alt.literal) ?? [])
            // an unknown-namespace key that ends several catalog paths is ambiguous
            if (use.ns === undefined && candidates.length > 1) candidates = []
        } else {
            const prefix = use.ns === undefined ? '(?:.+\\.)?' : use.ns ? `${use.ns.replace(/\./g, '\\.')}\\.` : ''
            const re = new RegExp(`^${prefix}${alt.pattern}$`)
            candidates = ctx.catalogKeys.filter((k) => re.test(k))
        }
        for (const key of candidates) {
            // on iOS a useAppTranslations key renders its iosCopy override when
            // one exists, so the key weighs whichever of the two is longer
            const override = use.ios ? iosOverrideKey(use.ns, key) : null
            const base = ctx.catalog.get(key)
            const ios = override ? ctx.catalog.get(override) : undefined
            if (base === undefined && ios === undefined) continue
            const words = Math.max(base ?? 0, ios ?? 0)
            if (!best || words > best.words) best = { key, words }
        }
    }
    return best
}

function buildContext(root) {
    const catalog = loadCatalog(root)
    const catalogKeys = [...catalog.keys()]
    const suffixIndex = new Map()
    for (const k of catalogKeys) {
        const parts = k.split('.')
        for (let i = 1; i < parts.length; i++) {
            const suffix = parts.slice(i).join('.')
            if (!suffixIndex.has(suffix)) suffixIndex.set(suffix, [])
            suffixIndex.get(suffix).push(k)
        }
    }
    return { root, catalog, catalogKeys, suffixIndex, files: new Map(), hookNs: new Map() }
}

/** `components/Kyc/x/y.tsx` -> `components/Kyc`; `app/(mobile-ui)/home/page.tsx` -> its route dir. */
function featureRoot(rel) {
    const parts = rel.split('/')
    if (parts[0] === 'app') return dirname(rel)
    return parts.slice(0, 2).join('/')
}

/**
 * Files a screen owns: the root, the .tsx components it imports directly,
 * and from there only components inside the same feature folder. The walk
 * stops at other screens and at shared primitives, so an embedded flow from
 * another feature (a KYC drawer inside a payment screen) is measured as its
 * own screen instead of inflating every page that can open it.
 */
function screenFiles(ctx, rootFile, isRoot) {
    const seen = new Set([rootFile])
    const queue = [{ file: rootFile, depth: 0 }]
    while (queue.length) {
        const { file, depth } = queue.shift()
        const fromRoot = featureRoot(srcRel(ctx.root, file))
        for (const imp of analyzeFile(ctx, file).imports) {
            const rel = srcRel(ctx.root, imp)
            if (seen.has(imp) || !imp.endsWith('.tsx') || isRoot(rel)) continue
            if (SHARED_DIRS.some((d) => rel.startsWith(d)) || EXCLUDED_COMPONENT_DIRS.some((d) => rel.startsWith(d)))
                continue
            if (depth > 1 && featureRoot(rel) !== fromRoot) continue
            seen.add(imp)
            queue.push({ file: imp, depth: depth + 1 })
        }
    }
    return [...seen]
}

function measureScreens(root) {
    const ctx = buildContext(root)
    const all = walk(join(root, 'src'))
    const roots = all.filter((f) => f.endsWith('.tsx') && isScreenRoot(srcRel(root, f)))
    const isRoot = (rel) => isScreenRoot(rel)
    const screens = []
    for (const file of roots) {
        const files = screenFiles(ctx, file, isRoot)
        const keys = new Map() // key -> weighted words
        let literal = 0
        let callouts = 0
        let unresolved = 0
        for (const f of files) {
            const a = analyzeFile(ctx, f)
            literal += a.literalWords
            callouts += a.callouts
            for (const use of a.keyUses) {
                const hit = resolveKeyUse(ctx, use)
                if (!hit) {
                    unresolved++
                    continue
                }
                keys.set(hit.key, Math.max(keys.get(hit.key) ?? 0, hit.words * use.weight))
            }
        }
        const keyWords = [...keys.values()].reduce((a, b) => a + b, 0)
        const top = [...keys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        screens.push({
            screen: srcRel(root, file),
            words: keyWords + literal,
            callouts,
            files: files.length,
            unresolved,
            top: top.map(([key, words]) => ({ key, words })),
        })
    }
    return screens.sort((a, b) => b.words - a.words || a.screen.localeCompare(b.screen))
}

/**
 * Screens over their limit: the baseline entry, or the budget for a screen
 * with no entry (or one under budget).
 */
function findRegressions(screens, baseline) {
    const budget = baseline.budget
    return screens.filter((s) => s.words > Math.max(budget, baseline.screens[s.screen] ?? 0))
}

module.exports = { countMessageWords, measureScreens, isScreenRoot, findRegressions, closingBrace, flattenCatalog }
