// AST extraction for the composition-drift matchers.
//
// The VALUE matchers in ds-lint-rules.cjs are regexes over class STRINGS and
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
// different tool. Same-file `const`s ARE resolved, lexically.

const ts = require('typescript')

/** Class-list producers: a call whose arguments are all class fragments. */
const BUILDERS = new Set(['twMerge', 'clsx', 'cn', 'classNames', 'cva', 'tw'])

/** Depth ceiling for const resolution — cheap insurance against a cyclic const. */
const MAX_DEPTH = 12

/**
 * Ceiling on alternative class lists carried through a combination. A variant
 * map crossed with another variant map is a product, and a pathological file
 * should slow nobody down; past the cap we collapse to a single merged list,
 * which is the old (over-counting) behaviour and never under-reports.
 */
const MAX_ALTERNATIVES = 64

/** "No pieces" is ONE empty alternative, not zero — zero would annihilate a product. */
const NOTHING = [[]]

/**
 * Hard ceiling on pieces carried in one alternative. A generated data file can
 * hold thousands of string entries in a single object literal; without a bound
 * the scanner spends its budget rebuilding arrays that no class list will ever
 * be, and on this repo's own audit-data.ts it exhausted the heap.
 */
const MAX_PIECES = 512

function isClassNameProp(name) {
    return /[a-zA-Z]*[cC]lassName$/.test(name)
}

function calleeName(node) {
    const callee = node.expression
    if (ts.isIdentifier(callee)) return callee.text
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text
    return null
}

function piece(node, text) {
    return { text, pos: node.getStart ? node.getStart() : node.pos }
}

/**
 * Combine two alternative-sets that apply AT THE SAME TIME (concatenation,
 * builder arguments, array join): every pairing is a class list the element can
 * actually receive.
 */
/** Truncate one alternative to the piece ceiling. */
function capPieces(list) {
    return list.length > MAX_PIECES ? list.slice(0, MAX_PIECES) : list
}

/**
 * Combine two alternative-sets that apply AT THE SAME TIME (concatenation,
 * builder arguments, array join): every pairing is a class list the element can
 * actually receive.
 *
 * Past the ceiling the product collapses to a single merged list — the old
 * flatten-everything behaviour, which over-counts rather than under-counts, so
 * the ratchet never loses tension to a budget.
 */
function product(left, right) {
    if (left.length * right.length > MAX_ALTERNATIVES) {
        return [capPieces([...left.flat(), ...right.flat()])]
    }
    const out = []
    for (const a of left) for (const b of right) out.push(capPieces([...a, ...b]))
    return out.length ? out : NOTHING
}

/**
 * The property values of an object literal, each as its own alternative.
 *
 * Accumulated in place with an early bail. Folding pairwise re-flattened the
 * whole accumulator once per property, which is quadratic — and a generated
 * data file with thousands of entries then exhausts the heap rather than
 * finishing the scan.
 */
function objectAlternatives(node, scopes, depth, seen) {
    const out = []
    // Entries past the ceiling are MERGED into one conservative alternative
    // rather than dropped. Returning early was a false NEGATIVE with teeth: 64
    // clean entries followed by a drifted one meant the drift walked past the
    // ratchet entirely. Merging can only over-count, which the baseline absorbs;
    // dropping loses debt silently, which is the one direction a ratchet must
    // never fail in.
    let overflow = null
    for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        for (const alt of alternatives(prop.initializer, scopes, depth + 1, seen)) {
            if (alt.length === 0) continue
            if (out.length < MAX_ALTERNATIVES) {
                out.push(alt)
            } else {
                overflow = overflow ? capPieces([...overflow, ...alt]) : alt
            }
        }
    }
    if (overflow) out.push(overflow)
    return out.length ? out : NOTHING
}

/** Look up an object-literal property by name, honouring same-file const resolution. */
function propertyByName(node, name, scopes, depth, seen) {
    const target = resolveToObjectLiteral(node, scopes, depth, seen)
    if (!target) return null
    for (const prop of target.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        const key = prop.name
        const keyText = ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : null
        if (keyText === name) return prop.initializer
    }
    return null
}

function resolveToObjectLiteral(node, scopes, depth, seen) {
    if (depth > MAX_DEPTH) return null
    if (ts.isObjectLiteralExpression(node)) return node
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return resolveToObjectLiteral(node.expression, scopes, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        if (seen.has(node.text)) return null
        const decl = lookup(scopes, node.text)
        if (!decl) return null
        const next = new Set(seen)
        next.add(node.text)
        return resolveToObjectLiteral(decl, scopes, depth + 1, next)
    }
    return null
}

/** Innermost lexical binding for a name. */
function lookup(scopes, name) {
    for (let i = scopes.length - 1; i >= 0; i--) {
        const found = scopes[i].get(name)
        if (found !== undefined) return found
    }
    return undefined
}

/**
 * Every class list an expression can produce, as a list of ALTERNATIVES — each
 * one a set of positioned string pieces that co-apply.
 *
 * Alternatives exist for lookup maps specifically. `{ sm: 'text-body-m', lg:
 * 'font-semibold' }` selects exactly one entry at runtime, and flattening the
 * table into a single list invented a stack out of two unrelated variants —
 * which, against a tight baseline, fails CI on a perfectly good variant map.
 *
 * Ternaries and `&&` guards are deliberately NOT alternatives: they are combined
 * as a product, which is what the pre-AST scanner did (it saw the whole
 * expression's source text) and what the baseline is calibrated on. Splitting
 * them would be a coverage change, not a bug fix, so it stays a separate
 * decision.
 */
function alternatives(node, scopes, depth = 0, seen = new Set()) {
    if (!node || depth > MAX_DEPTH) return NOTHING

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return [[piece(node, node.text)]]
    }
    if (ts.isTemplateExpression(node)) {
        let out = [[{ text: node.head.text, pos: node.head.pos }]]
        for (const span of node.templateSpans) {
            out = product(out, alternatives(span.expression, scopes, depth + 1, seen))
            out = product(out, [[{ text: span.literal.text, pos: span.literal.pos }]])
        }
        return out
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return alternatives(node.expression, scopes, depth + 1, seen)
    }
    if (ts.isBinaryExpression(node)) {
        const kind = node.operatorToken.kind
        if (
            kind === ts.SyntaxKind.PlusToken ||
            kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            kind === ts.SyntaxKind.BarBarToken ||
            kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
            return product(
                alternatives(node.left, scopes, depth + 1, seen),
                alternatives(node.right, scopes, depth + 1, seen)
            )
        }
        return NOTHING
    }
    if (ts.isConditionalExpression(node)) {
        return product(
            alternatives(node.whenTrue, scopes, depth + 1, seen),
            alternatives(node.whenFalse, scopes, depth + 1, seen)
        )
    }
    if (ts.isArrayLiteralExpression(node)) {
        let out = NOTHING
        for (const el of node.elements) {
            out = product(out, alternatives(el, scopes, depth + 1, seen))
            if (out.length === 1 && out[0].length >= MAX_PIECES) break
        }
        return out
    }
    if (ts.isObjectLiteralExpression(node)) {
        return objectAlternatives(node, scopes, depth, seen)
    }
    if (ts.isSpreadElement(node)) return alternatives(node.expression, scopes, depth + 1, seen)
    if (ts.isCallExpression(node)) {
        const name = calleeName(node)
        // `[...].join(' ')` — the form the header called out by name.
        if (name === 'join' && ts.isPropertyAccessExpression(node.expression)) {
            return alternatives(node.expression.expression, scopes, depth + 1, seen)
        }
        if (name && BUILDERS.has(name)) {
            let out = NOTHING
            for (const arg of node.arguments) out = product(out, alternatives(arg, scopes, depth + 1, seen))
            return out
        }
        return NOTHING
    }
    if (ts.isPropertyAccessExpression(node)) {
        // `SIZES.sm` selects ONE entry — resolve the key rather than taking the
        // whole table, which is how a two-variant map read as a stack.
        const selected = propertyByName(node.expression, node.name.text, scopes, depth, seen)
        if (selected) return alternatives(selected, scopes, depth + 1, seen)
        return alternatives(node.expression, scopes, depth + 1, seen)
    }
    if (ts.isElementAccessExpression(node)) {
        const arg = node.argumentExpression
        if (arg && ts.isStringLiteral(arg)) {
            const selected = propertyByName(node.expression, arg.text, scopes, depth, seen)
            if (selected) return alternatives(selected, scopes, depth + 1, seen)
        }
        // Unknown index: every entry is a candidate, each on its own.
        return alternatives(node.expression, scopes, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        if (seen.has(node.text)) return NOTHING
        const decl = lookup(scopes, node.text)
        if (!decl) return NOTHING
        const next = new Set(seen)
        next.add(node.text)
        return alternatives(decl, scopes, depth + 1, next)
    }
    return NOTHING
}

/**
 * `const` bindings declared directly in a scope's statement list.
 *
 * `const` only: a `let` or `var` can be reassigned after the declaration the
 * scanner would read, so inlining its initializer reports a class list that may
 * never exist. Per-scope, not file-wide: a flat name→initializer map let a
 * later declaration in an unrelated function overwrite an earlier one, which
 * both hid real stacks and invented fake ones depending on source order.
 */
function scopeBindings(statements) {
    const bindings = new Map()
    for (const statement of statements ?? []) {
        if (!ts.isVariableStatement(statement)) continue
        // eslint-disable-next-line no-bitwise
        if (!(statement.declarationList.flags & ts.NodeFlags.Const)) continue
        for (const decl of statement.declarationList.declarations) {
            if (ts.isIdentifier(decl.name) && decl.initializer) bindings.set(decl.name.text, decl.initializer)
        }
    }
    return bindings
}

function createsScope(node) {
    return ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) || ts.isCaseBlock(node)
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
    // as TSX yields syntax errors on perfectly good source. The default stays
    // TSX for bare snippets, which are the JSX ones.
    const kind = filename.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX
    const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, kind)
    // `createSourceFile` does not throw on a syntax error — it recovers, and the
    // recovered tree can be missing whole statements the source really has. A
    // scanner that walked one of those would under-report on exactly the files
    // it could not read, which is a ratchet with the tension quietly let out.
    // `parseDiagnostics` is not in TS's public types, hence the runtime guard:
    // absent, we treat the parse as untrusted.
    const diagnostics = source.parseDiagnostics
    if (!Array.isArray(diagnostics) || diagnostics.length > 0) return null

    const lists = []
    const scopes = []

    const visit = (node) => {
        const opensScope = createsScope(node)
        if (opensScope) scopes.push(scopeBindings(node.statements))

        if (ts.isJsxAttribute(node) && node.name && isClassNameProp(node.name.getText(source))) {
            const init = node.initializer
            const expr = init && ts.isJsxExpression(init) ? init.expression : init
            if (expr) lists.push(...alternatives(expr, scopes))
        } else if (ts.isCallExpression(node)) {
            const name = calleeName(node)
            if (name && BUILDERS.has(name)) lists.push(...alternatives(node, scopes))
        } else if (ts.isVariableDeclaration(node) && node.initializer) {
            lists.push(...alternatives(node.initializer, scopes))
        } else if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
            lists.push(...alternatives(node, scopes))
        }
        ts.forEachChild(node, visit)

        if (opensScope) scopes.pop()
    }
    visit(source)

    return lists.filter((list) => list.length > 0)
}

module.exports = { classLists, alternatives, scopeBindings, BUILDERS }
