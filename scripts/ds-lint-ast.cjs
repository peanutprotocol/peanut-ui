// AST extraction for the composition-drift matchers.
//
// The value matchers in ds-lint-rules.cjs are regexes over class STRINGS and
// stay that way — an off-scale `p-5` is off-scale wherever it appears. What
// needed a parser is GROUPING: `fontWeightOnTypeToken` has to know that a type
// token and a weight utility land in the SAME class list, and the regex
// region-finders could only see class lists spelled as attributes, builder
// calls, or template literals. Anything assembled through another static
// expression — `['text-body-m','font-semibold'].join(' ')`, `+` concatenation
// split across lines, a lookup map indexed at the call site — was invisible,
// and rebuilding those in regex means writing a parser badly.
//
// `typescript` rather than typescript-estree: TS is a direct dependency here,
// while typescript-estree is only present transitively via eslint. A script CI
// gates on should not reach through another package's dependency tree.
//
// Still out of scope, and honestly so: values imported from OTHER modules. That
// needs cross-file resolution, and a lint pass that reads its neighbours is a
// different tool. Same-file `const`s ARE resolved.

const ts = require('typescript')

/** Class-list producers: a call whose arguments are all class fragments. */
const BUILDERS = new Set(['twMerge', 'clsx', 'cn', 'classNames', 'cva', 'tw'])

/** Depth ceiling for const resolution — cheap insurance against a cyclic const. */
const MAX_DEPTH = 12

function isClassNameProp(name) {
    return /[a-zA-Z]*[cC]lassName$/.test(name)
}

function calleeName(node) {
    const callee = node.expression
    if (ts.isIdentifier(callee)) return callee.text
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text
    return null
}

/**
 * Every statically-known string piece an expression can contribute, each tagged
 * with the source position of the literal it came from.
 *
 * Deliberately UNION, not evaluation: both arms of a ternary and both sides of
 * `&&` contribute. A conditional class list is still one element's class list,
 * and the pre-AST regex — which saw the whole expression's source text — grouped
 * them the same way. Narrowing to one arm here would quietly drop drift the
 * ratchet already holds.
 */
function pieces(node, consts, depth = 0, seen = new Set()) {
    if (!node || depth > MAX_DEPTH) return []

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return [{ text: node.text, pos: node.getStart ? node.getStart() : node.pos }]
    }
    if (ts.isTemplateExpression(node)) {
        const out = [{ text: node.head.text, pos: node.head.pos }]
        for (const span of node.templateSpans) {
            out.push(...pieces(span.expression, consts, depth + 1, seen))
            out.push({ text: span.literal.text, pos: span.literal.pos })
        }
        return out
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return pieces(node.expression, consts, depth + 1, seen)
    }
    if (ts.isBinaryExpression(node)) {
        const kind = node.operatorToken.kind
        // `+` concatenation, and the `cond && 'cls'` / `a || 'cls'` guards that
        // are how conditional classes are actually written.
        if (
            kind === ts.SyntaxKind.PlusToken ||
            kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            kind === ts.SyntaxKind.BarBarToken ||
            kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
            return [...pieces(node.left, consts, depth + 1, seen), ...pieces(node.right, consts, depth + 1, seen)]
        }
        return []
    }
    if (ts.isConditionalExpression(node)) {
        return [...pieces(node.whenTrue, consts, depth + 1, seen), ...pieces(node.whenFalse, consts, depth + 1, seen)]
    }
    if (ts.isArrayLiteralExpression(node)) {
        return node.elements.flatMap((el) => pieces(el, consts, depth + 1, seen))
    }
    if (ts.isObjectLiteralExpression(node)) {
        // A lookup map of class strings. Every value is a candidate class list
        // for whichever key is selected at runtime; which one is not knowable,
        // and each is drift on its own if it stacks a weight on a token.
        return node.properties.flatMap((prop) =>
            ts.isPropertyAssignment(prop) ? pieces(prop.initializer, consts, depth + 1, seen) : []
        )
    }
    if (ts.isSpreadElement(node)) return pieces(node.expression, consts, depth + 1, seen)
    if (ts.isCallExpression(node)) {
        const name = calleeName(node)
        // `[...].join(' ')` — the form the header called out by name.
        if (name === 'join' && ts.isPropertyAccessExpression(node.expression)) {
            return pieces(node.expression.expression, consts, depth + 1, seen)
        }
        if (name && BUILDERS.has(name)) {
            return node.arguments.flatMap((arg) => pieces(arg, consts, depth + 1, seen))
        }
        return []
    }
    if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
        // `SIZES[variant]` / `SIZES.sm` — resolve the map, take every value.
        return pieces(node.expression, consts, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        if (seen.has(node.text)) return []
        const decl = consts.get(node.text)
        if (!decl) return []
        const next = new Set(seen)
        next.add(node.text)
        return pieces(decl, consts, depth + 1, next)
    }
    return []
}

/** Same-file `const NAME = …` initializers, for identifier resolution. */
function collectConsts(source) {
    const consts = new Map()
    const visit = (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
            consts.set(node.name.text, node.initializer)
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    return consts
}

/**
 * Every class list in a file, as arrays of positioned string pieces.
 *
 * Four producers, matching what the regex scanner covered plus what it could
 * not reach: `*ClassName` JSX attributes, builder calls, standalone template
 * literals, and variable initializers (the pre-AST scanner caught the last as
 * a per-line pass over whatever text the region-finders had not consumed).
 *
 * Overlap is expected and harmless — a builder call inside a className
 * attribute is reached twice — because callers dedupe on the LITERAL POSITIONS
 * a match came from, not on the class list.
 *
 * Returns `null` when the source does not parse cleanly, so the caller can fall
 * back rather than trust a recovered tree.
 */
function classLists(text, filename = 'file.tsx') {
    // Script kind by extension. TSX is not a superset: in a .ts file `<T>value`
    // is a type assertion and `<T,>(x) => x` a generic arrow, and parsing those
    // as TSX yields syntax errors on perfectly good source (3 files in src/ at
    // the time of writing). The default stays TSX for bare snippets, which are
    // the JSX ones.
    const kind = filename.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX
    const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, kind)
    // `createSourceFile` does not throw on a syntax error — it recovers, and the
    // recovered tree can be missing whole statements the source really has. A
    // scanner that walked one of those would under-report on exactly the files
    // it could not read, which is a ratchet with the tension quietly let out. So
    // a parse with syntax errors is reported as unusable and the caller falls
    // back to the regex scanner. `parseDiagnostics` is not in TS's public types,
    // hence the runtime guard: absent, we treat the parse as untrusted.
    const diagnostics = source.parseDiagnostics
    if (!Array.isArray(diagnostics) || diagnostics.length > 0) return null

    const consts = collectConsts(source)
    const lists = []

    const visit = (node) => {
        if (ts.isJsxAttribute(node) && node.name && isClassNameProp(node.name.getText(source))) {
            const init = node.initializer
            const expr = init && ts.isJsxExpression(init) ? init.expression : init
            if (expr) lists.push(pieces(expr, consts))
        } else if (ts.isCallExpression(node)) {
            const name = calleeName(node)
            if (name && BUILDERS.has(name)) lists.push(pieces(node, consts))
        } else if (ts.isVariableDeclaration(node) && node.initializer) {
            lists.push(pieces(node.initializer, consts))
        } else if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
            lists.push(pieces(node, consts))
        }
        ts.forEachChild(node, visit)
    }
    visit(source)

    return lists.filter((list) => list.length > 0)
}

module.exports = { classLists, pieces, collectConsts, BUILDERS }
