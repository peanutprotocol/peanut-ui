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
// different tool. Same-file bindings ARE resolved, lexically.
//
// What this module carries is a SUMMARY, not the class strings. An alternative
// is reduced to "where is its type token, where is its weight utility" the
// moment it is built. Carrying the strings and bounding them later forced a
// choice between merging siblings (a false stack across two variants of a
// lookup map) and truncating them (real drift in a late entry going unseen) —
// both of which shipped, and both of which this shape removes: summaries dedupe
// on their own, and when a bound is applied the MATCHES are kept first, so a
// budget can never hide debt.

const ts = require('typescript')

/** Class-list producers: a call whose arguments are all class fragments. */
const BUILDERS = new Set(['twMerge', 'clsx', 'cn', 'classNames', 'cva', 'tw'])

/** Depth ceiling for binding resolution — cheap insurance against a cyclic const. */
const MAX_DEPTH = 12

/**
 * Ceiling on distinct alternatives tracked through one combination. Reached only
 * by pathological files; when it bites, alternatives that already MATCH are kept
 * ahead of ones that do not, so the bound can cost precision but never a finding.
 */
const MAX_ALTERNATIVES = 256

/**
 * How an object literal reached here. A class-builder argument means its KEYS
 * are class fragments and entries co-apply; a lookup means exactly one entry is
 * selected. See the ObjectLiteralExpression branch.
 */
const BUILDER_OBJECT = 'builder'
const LOOKUP_OBJECT = 'lookup'

/** A name that is bound but whose value we refuse to inline (param, let, var, import…). */
const OPAQUE = Symbol('opaque-binding')

/** An alternative reduced to what the metric needs: where its token and weight are. */
const EMPTY_ALT = { token: null, weight: null }
const NOTHING = [EMPTY_ALT]

const altKey = (alt) => `${alt.token ?? '-'}:${alt.weight ?? '-'}`
const isMatch = (alt) => alt.token !== null && alt.weight !== null

/**
 * Dedupe, and bound without ever losing a finding — present or future.
 *
 * Truncating a deduped list dropped PARTIALS that had not composed yet: a
 * weight-only alternative sitting past the cap still forms a real stack once the
 * outer token products with it, and slicing it away reported zero. So when the
 * bound bites, every full match is kept AND one representative of each partial
 * shape — token-only, weight-only, neither. One representative is enough: any
 * match those partials could form, they can still form.
 */
function normalize(alts) {
    const seen = new Map()
    for (const alt of alts) {
        const key = altKey(alt)
        if (!seen.has(key)) seen.set(key, alt)
    }
    const out = [...seen.values()]
    if (out.length <= MAX_ALTERNATIVES) return out

    const kept = out.filter(isMatch)
    const shapes = new Set()
    for (const alt of out) {
        if (isMatch(alt)) continue
        const shape = `${alt.token !== null}:${alt.weight !== null}`
        if (shapes.has(shape)) continue
        shapes.add(shape)
        kept.push(alt)
    }
    return kept
}

/** Combine alternative-sets that apply AT THE SAME TIME (concatenation, builder args, join). */
function product(left, right) {
    const out = []
    for (const a of left) {
        for (const b of right) {
            out.push({ token: a.token ?? b.token, weight: a.weight ?? b.weight })
        }
    }
    return normalize(out.length ? out : NOTHING)
}

/** Combine alternative-sets where exactly ONE applies at runtime (lookup-map entries). */
function union(left, right) {
    return normalize([...left, ...right])
}

function isClassNameProp(name) {
    return /[a-zA-Z]*[cC]lassName$/.test(name)
}

function calleeName(node) {
    const callee = node.expression
    if (ts.isIdentifier(callee)) return callee.text
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text
    return null
}

function startOf(node) {
    return node.getStart ? node.getStart() : node.pos
}

/**
 * Innermost lexical binding for a name, WITH the scope chain it was declared in.
 *
 * The chain matters: an initializer has to be evaluated where it was written,
 * not where the name is used. `const alias = style` at module level means the
 * module's `style`, even if the use site sits inside a function that declares
 * its own — re-evaluating against the use-site scopes picked the local namesake
 * and reported the wrong answer in both directions.
 *
 * OPAQUE stops the walk; it does not fall through to an outer scope.
 */
function lookup(scopes, name) {
    for (let i = scopes.length - 1; i >= 0; i--) {
        if (scopes[i].has(name)) return { value: scopes[i].get(name), scopes: scopes.slice(0, i + 1) }
    }
    return undefined
}

/**
 * Resolve an expression to the object literal it denotes, WITH the scope chain
 * that literal was written in.
 *
 * The chain travels with the node for the same reason it does in {@link lookup}:
 * a table declared at module level means the module's bindings, and its entries
 * have to be evaluated there. Handing back a bare node let the caller re-evaluate
 * a module-level entry against a function's scopes and pick a local namesake.
 */
function resolveToObjectLiteral(node, ctx, depth, seen) {
    if (!node || depth > MAX_DEPTH) return null
    if (ts.isObjectLiteralExpression(node)) return { node, scopes: ctx.scopes }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return resolveToObjectLiteral(node.expression, ctx, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound.value === OPAQUE || seen.has(bound.value)) return null
        const next = new Set(seen)
        next.add(bound.value)
        return resolveToObjectLiteral(bound.value, { ...ctx, scopes: bound.scopes }, depth + 1, next)
    }
    return null
}

/**
 * A resolved object's fields in SOURCE order, with static spreads flattened in
 * place.
 *
 * Source order is what makes last-wins expressible, and flattening in place is
 * what makes `{ ...CONFIG, variants: … }` behave the way the runtime does. A
 * spread that cannot be resolved is RECORDED rather than dropped: it could
 * carry any key, so no caller may claim a key is absent behind one.
 */
function objectFields(table, ctx, depth, seen, into = []) {
    if (depth > MAX_DEPTH) return into
    const inner = { ...ctx, scopes: table.scopes }
    for (const prop of table.node.properties) {
        if (ts.isSpreadAssignment(prop)) {
            const spread = resolveToObjectLiteral(prop.expression, inner, depth, seen)
            if (spread) objectFields(spread, inner, depth + 1, seen, into)
            // The EXPRESSION is kept, not dropped: a caller that has to stay
            // conservative about what an unreadable spread carried needs
            // something to evaluate.
            else into.push({ key: null, value: prop.expression, ctx: inner, opaqueSpread: true })
            continue
        }
        const shorthand = ts.isShorthandPropertyAssignment(prop)
        if (!ts.isPropertyAssignment(prop) && !shorthand) continue
        const key = shorthand ? prop.name.text : staticKeyName(prop.name, inner, depth + 1, seen)
        into.push({
            key,
            value: shorthand ? prop.name : prop.initializer,
            ctx: inner,
            // An unreadable computed key can be ANY name, including one written
            // definitively earlier in the same literal.
            dynamicKey: key === null && !shorthand && ts.isComputedPropertyName(prop.name),
        })
    }
    return into
}

/**
 * Fields reduced to the ONE that wins per key, in first-appearance order.
 *
 * Keyless records — an opaque spread, an unreadable computed name — are dropped
 * here BY DESIGN: they name nothing, so no key can be resolved to them. Callers
 * that need to stay conservative about what such a record might have carried
 * read them separately; see {@link opaqueFields}.
 */
function effectiveFields(fields) {
    const byKey = new Map()
    for (const field of fields) {
        if (field.key === null) continue
        byKey.set(field.key, field)
    }
    return [...byKey.values()]
}

/** The records that name nothing readable — an opaque spread or a dynamic key. */
function opaqueFields(fields) {
    return fields.filter((field) => field.key === null)
}

/**
 * Every value the named property can hold, later-wins first.
 *
 * `resolved` is the load-bearing half: an empty `values` beside it means the key
 * is PROVABLY absent — `{ sm: … }.lg` renders nothing at all — while an
 * unresolved table, or one hiding an opaque spread, cannot say that and leaves
 * the caller to union the whole thing.
 *
 * More than one value when a LATER computed key cannot be read: `{ x: a, [k]: b }`
 * really is `b` when `k === 'x'`, so committing to `a` reports a class list the
 * expression can produce a different one of. Both are kept and the caller unions.
 */
function propertiesByName(node, name, ctx, depth, seen) {
    const table = resolveToObjectLiteral(node, ctx, depth, seen)
    if (!table) return { resolved: false, values: [] }
    const fields = objectFields(table, ctx, depth, seen)
    const values = []
    // Backwards, because later properties win.
    for (let i = fields.length - 1; i >= 0; i--) {
        const field = fields[i]
        if (field.key === name) {
            values.push({ value: field.value, scopes: field.ctx.scopes })
            return { resolved: true, values }
        }
        // Either could be the requested key under another name.
        if (field.dynamicKey) values.push({ value: field.value, scopes: field.ctx.scopes })
        else if (field.opaqueSpread) return { resolved: false, values }
    }
    // Ran off the front with no definite match: the key really is not there.
    return { resolved: true, values }
}

/** The single winning value for a name, ignoring any dynamic aliases. */
function propertyByName(node, name, ctx, depth, seen) {
    const { values } = propertiesByName(node, name, ctx, depth, seen)
    return values.length > 0 ? values[values.length - 1] : null
}

/**
 * The FULL literal text an expression renders to, or null when any part of it is
 * not statically known.
 *
 * Different from reading one fragment: a `+` chain only has a known text if
 * every operand does, and it is the whole concatenation that matters. `'a' +
 * 'b'` renders `ab`, one class — which is the entire reason concatenation cannot
 * be treated as composition.
 *
 * Same-file consts fold too, in their OWN declaration scope. `const prefix =
 * 'text-body'` makes `prefix + '-m font-semibold'` render a type token and a
 * weight; refusing the identifier reported neither, and the mirror case
 * (`token + 'font-semibold'`, one glued class) reported a stack that never
 * renders. Both are answered by classifying the rendered string.
 */
function staticText(node, ctx, depth = 0, seen = new Set()) {
    if (!node || depth > MAX_DEPTH) return null
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    // A primitive operand coerces rather than separating: `'a' + 1 + 'b'` is the
    // single class `a1b`, and refusing the number invented two class boundaries
    // that do not exist. Every statically known primitive folds, or the ones
    // left out reach the dynamic product and invent the boundaries again.
    if (ts.isNumericLiteral(node)) return String(Number(node.text))
    // `1n` renders `1` — the literal's text carries the suffix.
    if (ts.isBigIntLiteral(node)) return node.text.replace(/n$/, '')
    if (node.kind === ts.SyntaxKind.TrueKeyword) return 'true'
    if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false'
    if (node.kind === ts.SyntaxKind.NullKeyword) return 'null'
    // `-1` is a unary expression, not a negative literal.
    if (
        ts.isPrefixUnaryExpression(node) &&
        (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
        (ts.isNumericLiteral(node.operand) || ts.isBigIntLiteral(node.operand))
    ) {
        const magnitude = staticText(node.operand, ctx, depth + 1, seen)
        if (magnitude === null) return null
        return node.operator === ts.SyntaxKind.MinusToken ? String(-Number(magnitude)) : magnitude
    }
    if (ts.isTemplateExpression(node)) {
        let text = node.head.text
        for (const span of node.templateSpans) {
            const spanText = staticText(span.expression, ctx, depth + 1, seen)
            if (spanText === null) return null
            text += spanText + span.literal.text
        }
        return text
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return staticText(node.expression, ctx, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        if (!ctx) return null
        const bound = lookup(ctx.scopes, node.text)
        // `undefined` is an ordinary identifier, so it only renders `undefined`
        // while nothing shadows it — a parameter named `undefined` is a real
        // binding whose value we do not know.
        if (!bound && node.text === 'undefined') return 'undefined'
        if (!bound || bound.value === OPAQUE || seen.has(bound.value)) return null
        const next = new Set(seen)
        next.add(bound.value)
        return staticText(bound.value, { ...ctx, scopes: bound.scopes }, depth + 1, next)
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = staticText(node.left, ctx, depth + 1, seen)
        if (left === null) return null
        const right = staticText(node.right, ctx, depth + 1, seen)
        return right === null ? null : left + right
    }
    return null
}

/**
 * A property name's literal text, including a COMPUTED name that resolves to a
 * static string.
 *
 * `clsx({ ['text-body-m']: on })` renders `text-body-m` exactly as the quoted
 * form does, and `SIZES[k]` has to select the same entry either way — so one
 * resolver, used by the builder branch and by {@link propertyByName}.
 */
function staticKeyName(name, ctx, depth = 0, seen = new Set()) {
    if (!name) return null
    if (
        ts.isIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNoSubstitutionTemplateLiteral(name) ||
        // `{ 0: … }` is a property named "0" — the runtime stringifies the key.
        ts.isNumericLiteral(name)
    ) {
        return name.text
    }
    if (ts.isComputedPropertyName(name)) return staticText(name.expression, ctx, depth, seen)
    return null
}

/** Union the alternatives of every value a name can select, each in its own scope. */
function unionOfSelected(selected, ctx, depth, seen) {
    let out = null
    for (const entry of selected) {
        const alts = alternatives(entry.value, { ...ctx, scopes: entry.scopes }, depth + 1, seen, LOOKUP_OBJECT)
        out = out ? union(out, alts) : alts
    }
    return out ?? NOTHING
}

function literalAlt(node, text, ctx) {
    const pos = startOf(node)
    return [{ token: ctx.isToken(text) ? pos : null, weight: ctx.isWeight(text) ? pos : null }]
}

/**
 * A numeric index an expression denotes, following same-file consts the way
 * {@link staticText} does for strings. Null when it is not statically known.
 */
function staticIndex(node, ctx, depth = 0, seen = new Set()) {
    if (!node || depth > MAX_DEPTH) return null
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return staticIndex(node.expression, ctx, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        if (!ctx) return null
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound.value === OPAQUE || seen.has(bound.value)) return null
        const next = new Set(seen)
        next.add(bound.value)
        return staticIndex(bound.value, { ...ctx, scopes: bound.scopes }, depth + 1, next)
    }
    return null
}

/**
 * Every class list an expression can produce, as deduped ALTERNATIVES.
 *
 * Alternatives exist for lookup maps specifically. `{ sm: 'text-body-m', lg:
 * 'font-semibold' }` selects exactly one entry at runtime, and treating the
 * table as a single list invents a stack out of two unrelated variants.
 *
 * Ternaries and `&&` guards are deliberately NOT alternatives: they combine as a
 * product, which is what the pre-AST scanner did (it saw the whole expression's
 * source text) and what the baseline is calibrated on. Splitting them would be a
 * coverage change, not a bug fix, so it stays a separate decision.
 */
function alternatives(node, ctx, depth = 0, seen = new Set(), mode = LOOKUP_OBJECT) {
    if (!node || depth > MAX_DEPTH) return NOTHING

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return literalAlt(node, node.text, ctx)
    }
    if (ts.isTemplateExpression(node)) {
        // A template with only static spans renders one string, and the classes
        // that TOUCH a span boundary fuse into one — exactly as a `+` chain
        // does. Classifying the pieces separately both missed `${'text-body'}-m`
        // and invented a stack for `${'text-body-m'}font-semibold`.
        const rendered = staticText(node, ctx, depth + 1, seen)
        if (rendered !== null) return literalAlt(node, rendered, ctx)
        let out = literalAlt(node.head, node.head.text, ctx)
        for (const span of node.templateSpans) {
            out = product(out, alternatives(span.expression, ctx, depth + 1, seen, mode))
            out = product(out, literalAlt(span.literal, span.literal.text, ctx))
        }
        return out
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return alternatives(node.expression, ctx, depth + 1, seen, mode)
    }
    if (ts.isBinaryExpression(node)) {
        const kind = node.operatorToken.kind
        if (kind === ts.SyntaxKind.PlusToken) {
            // `+` GLUES, and only the two classes touching the join actually
            // fuse. `'text-body-m' + 'font-semibold'` renders ONE class,
            // `text-body-mfont-semibold`, so it is no stack at all; but
            // `'text-body-m x' + 'y font-semibold'` renders `text-body-m xy
            // font-semibold`, where the token and the weight are still separate
            // classes and DO stack.
            //
            // No boundary rule gets both of those right, because the answer
            // depends on the whole rendered string rather than on the join. When
            // every operand is static there is no need to guess: fold the
            // concatenation and read the class list it really produces.
            const rendered = staticText(node, ctx, depth + 1, seen)
            if (rendered !== null) return literalAlt(node, rendered, ctx)
            // Something in the chain is dynamic, so the rendered text is
            // unknowable. Compose — over-counting is the safe direction for a
            // debt ratchet, and it is the direction the pre-AST scanner took.
            return product(
                alternatives(node.left, ctx, depth + 1, seen, mode),
                alternatives(node.right, ctx, depth + 1, seen, mode)
            )
        }
        if (
            kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            kind === ts.SyntaxKind.BarBarToken ||
            kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
            return product(
                alternatives(node.left, ctx, depth + 1, seen, mode),
                alternatives(node.right, ctx, depth + 1, seen, mode)
            )
        }
        return NOTHING
    }
    if (ts.isConditionalExpression(node)) {
        return product(
            alternatives(node.whenTrue, ctx, depth + 1, seen, mode),
            alternatives(node.whenFalse, ctx, depth + 1, seen, mode)
        )
    }
    if (ts.isArrayLiteralExpression(node)) {
        // Same producer question as an object. Flattened by a builder or joined
        // into one string, the entries CO-APPLY. Indexed, exactly one is
        // selected — and producting those invented a stack across two entries of
        // a perfectly good variant list.
        if (mode === BUILDER_OBJECT) {
            let out = NOTHING
            for (const el of node.elements) out = product(out, alternatives(el, ctx, depth + 1, seen, mode))
            return out
        }
        let out = []
        for (const el of node.elements) out = union(out, alternatives(el, ctx, depth + 1, seen, mode))
        return out.length ? out : NOTHING
    }
    if (ts.isObjectLiteralExpression(node)) {
        // An object literal means two different things, and the producer decides
        // which. In a class-BUILDER argument (`clsx({ 'a b': cond })`, and a
        // `cva` variant table) the KEYS are class fragments and several can be
        // true at once, so entries CO-APPLY. Reached through a lookup instead
        // (`SIZES[variant]`), exactly one entry is selected, so entries are
        // ALTERNATIVES. Treating every object as a lookup lost the builder form
        // entirely — the old regex counter caught it and this did not, which is
        // a coverage regression, not a refinement.
        //
        // EVERY property is scanned either way — the bound applies to distinct
        // summaries, not to how far into the object we got, so a late entry
        // cannot hide.
        if (mode === BUILDER_OBJECT) {
            let out = NOTHING
            for (const prop of node.properties) {
                if (ts.isSpreadAssignment(prop)) {
                    out = product(out, alternatives(prop.expression, ctx, depth + 1, seen, mode))
                    continue
                }
                // Only the KEY is emitted. `clsx({ 'text-body-m': enabled })`
                // renders `text-body-m`; `enabled` is a truthiness test, not a
                // class, and reading it as one stacked a weight from a condition
                // that never reaches the element. A builder call nested in a
                // value is still analysed — the walker visits every node — it
                // just does not compose with the keys around it.
                const key = ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop) ? prop.name : null
                const keyText = staticKeyName(key, ctx, depth + 1, seen)
                if (keyText !== null) {
                    out = product(out, literalAlt(key, keyText, ctx))
                }
            }
            return out
        }
        let out = []
        for (const prop of node.properties) {
            // A spread contributes its source's entries as alternatives too —
            // `{ ...BASE }` is still a lookup table, and skipping it made every
            // entry it carries invisible.
            if (ts.isSpreadAssignment(prop)) {
                out = union(out, alternatives(prop.expression, ctx, depth + 1, seen, mode))
                continue
            }
            // `{ sm }` binds the same value as `{ sm: sm }` — skipping shorthand
            // made the entry invisible and the whole table read as one option
            // shorter.
            if (ts.isShorthandPropertyAssignment(prop)) {
                out = union(out, alternatives(prop.name, ctx, depth + 1, seen, mode))
                continue
            }
            if (!ts.isPropertyAssignment(prop)) continue
            out = union(out, alternatives(prop.initializer, ctx, depth + 1, seen, mode))
        }
        return out.length ? out : NOTHING
    }
    if (ts.isSpreadElement(node)) return alternatives(node.expression, ctx, depth + 1, seen, mode)
    if (ts.isCallExpression(node)) {
        const name = calleeName(node)
        if (name === 'join' && ts.isPropertyAccessExpression(node.expression)) {
            // Only a WHITESPACE separator composes a class list. `.join(',')`
            // yields the single class `a,b`, and `.join()` defaults to a comma —
            // treating either as composition reports a stack that no element
            // ever receives, and rejects valid non-class string assembly.
            const sep = node.arguments[0]
            // Through the same const-resolving walk as everything else: a
            // hoisted `const SPACE = ' '` composes exactly like the literal.
            const sepText = sep === undefined ? null : staticText(sep, ctx, depth + 1, seen)
            const isWhitespace = sepText !== null && sepText.length > 0 && sepText.trim() === ''
            return alternatives(
                node.expression.expression,
                ctx,
                depth + 1,
                seen,
                isWhitespace ? BUILDER_OBJECT : LOOKUP_OBJECT
            )
        }
        if (name === 'cva') return cvaAlternatives(node, ctx, depth, seen)
        if (name && BUILDERS.has(name)) {
            let out = NOTHING
            for (const arg of node.arguments) {
                out = product(out, alternatives(arg, ctx, depth + 1, seen, BUILDER_OBJECT))
            }
            return out
        }
        return NOTHING
    }
    if (ts.isPropertyAccessExpression(node)) {
        // Indexing SELECTS one entry, so the object it reads is a lookup even
        // inside a builder call: `clsx(SIZES[variant])` picks a variant, it does
        // not apply the whole table.
        const selected = propertiesByName(node.expression, node.name.text, ctx, depth, seen)
        // `resolved` says the table was READ to the end, so an empty result
        // means the key is provably absent and the access renders nothing —
        // unioning the table there borrows a class from an entry the name can
        // never reach. An UNRESOLVED result is a partial list, not a complete
        // one: the definite property may still be sitting behind the opaque
        // spread that stopped the walk, so union it with the whole table.
        if (selected.resolved) return unionOfSelected(selected.values, ctx, depth, seen)
        const whole = alternatives(node.expression, ctx, depth + 1, seen, LOOKUP_OBJECT)
        return selected.values.length > 0 ? union(unionOfSelected(selected.values, ctx, depth, seen), whole) : whole
    }
    if (ts.isElementAccessExpression(node)) {
        // A constant key SELECTS one entry, exactly as a property access does —
        // whatever chain of same-file consts spells it. Unwrapping the key only
        // one level left `const k = actual` reading as dynamic, and the union
        // fallback then borrowed a class from an entry the key cannot reach.
        const arg = node.argumentExpression
        // A numeric index is also a property NAME: `{ 0: … }[0]` selects, and
        // the runtime stringifies the key. Try the object first, then the array.
        const index = staticIndex(arg, ctx, depth + 1, seen)
        const keyText = staticText(arg, ctx, depth + 1, seen) ?? (index === null ? null : String(index))
        if (keyText !== null) {
            const selected = propertiesByName(node.expression, keyText, ctx, depth, seen)
            if (selected.resolved) return unionOfSelected(selected.values, ctx, depth, seen)
            if (selected.values.length > 0) {
                // Partial, for the same reason as the property-access branch.
                const whole = alternatives(node.expression, ctx, depth + 1, seen, LOOKUP_OBJECT)
                return union(unionOfSelected(selected.values, ctx, depth, seen), whole)
            }
        }
        if (index !== null) {
            const selected = elementByIndex(node.expression, index, ctx, depth, seen)
            if (selected) {
                if (!selected.value) return NOTHING
                return alternatives(selected.value, { ...ctx, scopes: selected.scopes }, depth + 1, seen, LOOKUP_OBJECT)
            }
        }
        return alternatives(node.expression, ctx, depth + 1, seen, LOOKUP_OBJECT)
    }
    if (ts.isIdentifier(node)) {
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound.value === OPAQUE || seen.has(bound.value)) return NOTHING
        const next = new Set(seen)
        next.add(bound.value)
        // Evaluated in the chain the binding was DECLARED in, not the one it is
        // used from.
        const outer = { ...ctx, scopes: bound.scopes }
        return alternatives(bound.value, outer, depth + 1, next, mode)
    }
    return NOTHING
}

/**
 * The option names a cva compound selector fires for, or null when it cannot be
 * read down to names.
 *
 * `size: 'sm'` names one; `size: ['sm', 'md']` names two and the compound fires
 * for either, so they union. An EMPTY list comes back as an empty array, not as
 * null: cva tests an array selector with `includes`, so `[]` matches nothing and
 * the compound can never fire — a resolved impossibility, not an unknown.
 * Anything else — a boolean axis, a computed name — is unreadable and leaves its
 * axis unconstrained.
 */
function selectorOptionNames(node, ctx, depth, seen) {
    const single = staticText(node, ctx, depth, seen)
    if (single !== null) return [single]
    const table = resolveToArrayLiteral(node, ctx, depth, seen)
    if (!table) return null
    const names = []
    for (const el of table.elements) {
        const text = staticText(el, { ...ctx, scopes: table.scopes }, depth + 1, seen)
        if (text === null) return null
        names.push(text)
    }
    return names
}

/**
 * A variants table's classes: union WITHIN each axis, product ACROSS them.
 *
 * Used for a table hidden behind an unreadable spread, where the axes have no
 * names to record. Unioning the whole table instead read two hidden axes as
 * alternatives, so selecting one option from each never produced the stack they
 * really render together.
 */
function variantsTableAlts(table, ctx, depth, seen) {
    let out = NOTHING
    const fields = objectFields(table, ctx, depth, seen)
    for (const axis of effectiveFields(fields)) {
        out = product(out, alternatives(axis.value, axis.ctx, depth + 1, seen, LOOKUP_OBJECT))
    }
    for (const opaque of opaqueFields(fields)) {
        if (opaque.value) out = product(out, alternatives(opaque.value, opaque.ctx, depth + 1, seen, LOOKUP_OBJECT))
    }
    return out
}

/**
 * A compound ENTRY's own classes — its `class`/`className` field, in BUILDER
 * mode so an array of classes composes instead of reading as alternatives.
 *
 * Used for an entry hidden behind an unreadable spread. Reading the whole entry
 * in lookup mode unioned its fields, which made `class: ['a', 'b']` — two
 * classes cva renders together — look mutually exclusive.
 */
function compoundEntryClasses(table, ctx, depth, seen) {
    let out = NOTHING
    for (const field of effectiveFields(objectFields(table, ctx, depth, seen))) {
        if (field.key !== 'class' && field.key !== 'className') continue
        out = product(out, alternatives(field.value, field.ctx, depth + 1, seen, BUILDER_OBJECT))
    }
    return out
}

/**
 * `cva(base, config)` — the one builder whose config is not a flat bag of
 * conditional classes.
 *
 * Within an AXIS the options are mutually exclusive: `size: { sm, lg }` renders
 * one of them, so treating the axis as co-applying invents a stack across two
 * variants of a valid table. ACROSS axes they combine — `size` and `weight` are
 * selected independently and both land on the element — as do the base classes
 * and any compound entry that matches.
 */
function cvaAlternatives(node, ctx, depth, seen) {
    const [base, config] = node.arguments
    const baseAlts = base ? alternatives(base, ctx, depth + 1, seen, BUILDER_OBJECT) : NOTHING
    if (!config) return baseAlts

    const configTable = resolveToObjectLiteral(config, ctx, depth, seen)
    if (!configTable) {
        return product(baseAlts, alternatives(config, ctx, depth + 1, seen, BUILDER_OBJECT))
    }
    return product(baseAlts, cvaConfigAlternatives(configTable, ctx, depth, seen))
}

/**
 * Everything one cva CONFIG object renders, with no base classes of its own.
 *
 * Split out so a config hidden behind an unreadable spread can be recomposed
 * through exactly this path instead of being flattened into a bag of values.
 */
function cvaConfigAlternatives(configTable, ctx, depth, seen) {
    const baseAlts = NOTHING
    let out = baseAlts
    const configCtx = { ...ctx, scopes: configTable.scopes }

    let variants = null
    let compounds = null
    // Every axis by name, so a compound can product against the ones it leaves free.
    const axisAlts = new Map()
    // Spreads flattened in place and reduced to the winner per key. Composing
    // BOTH `variants` fields of `{ ...CONFIG, variants: … }` put the overridden
    // table's classes into the output beside the ones that actually render.
    const configFields = objectFields(configTable, configCtx, depth, seen)
    // A config spread we cannot resolve — `{ ...(cond ? A : B) }` — may carry
    // any of these fields. Dropping it lost every axis it could have brought, so
    // its own alternatives are producted in: over-counting, the safe direction.
    //
    // Composed under cva's OWN semantics, not flattened. Each object the spread
    // can be is a config in its own right — `variants` products across axes and
    // a compound's classes ride on the options it pins — so the candidates are
    // recomposed and unioned. Reading the spread as a bag of values instead lost
    // every combination inside it: a config carrying both a variants table and a
    // compound that selects from it reported neither together.
    for (const opaque of opaqueFields(configFields)) {
        if (!opaque.value) continue
        const candidates = resolveToObjectLiterals(opaque.value, opaque.ctx, depth, seen)
        if (candidates.length === 0) {
            out = product(out, alternatives(opaque.value, opaque.ctx, depth + 1, seen, LOOKUP_OBJECT))
            continue
        }
        let composed = null
        for (const candidate of candidates) {
            const alts = cvaConfigAlternatives(candidate, { ...ctx, scopes: candidate.scopes }, depth + 1, seen)
            composed = composed ? union(composed, alts) : alts
        }
        out = product(out, composed ?? NOTHING)
    }
    for (const { key, value: field, ctx: fieldCtx } of effectiveFields(configFields)) {
        if (key === 'variants') {
            variants = resolveToObjectLiteral(field, fieldCtx, depth, seen)
            if (!variants) continue
            const variantsCtx = { ...ctx, scopes: variants.scopes }
            // Same reader as the config: `{ ...TONE, size: … }` is how a table
            // gets composed once an axis is hoisted, and skipping the spread
            // lost every axis it carried. Names come from `staticKeyName`, so a
            // computed `[axis]:` is recorded too — an unnamed axis was invisible
            // to `axisAlts` and could never be a free axis for a compound.
            const variantFields = objectFields(variants, variantsCtx, depth, seen)
            for (const axis of effectiveFields(variantFields)) {
                // union WITHIN the axis, product ACROSS axes
                const alts = alternatives(axis.value, axis.ctx, depth + 1, seen, LOOKUP_OBJECT)
                axisAlts.set(axis.key, alts)
                out = product(out, alts)
            }
            // An axis table spread in from something unreadable co-applies with
            // the ones named here, exactly as a named axis does. It has no name
            // for a compound to PIN, but it is still a free axis for every
            // compound — leaving it out of `axisAlts` meant a compound pinned
            // elsewhere never combined with the classes it can carry. Keyed by
            // the node so two unreadable spreads stay distinct, and no compound
            // selector can ever match the key.
            for (const opaque of opaqueFields(variantFields)) {
                if (!opaque.value) continue
                const candidates = resolveToObjectLiterals(opaque.value, opaque.ctx, depth, seen)
                let alts = null
                for (const candidate of candidates) {
                    // A TABLE, so its own axes product together — one spread can
                    // hide several, and unioning them read independently
                    // selected axes as alternatives.
                    const composed = variantsTableAlts(candidate, { ...ctx, scopes: candidate.scopes }, depth + 1, seen)
                    alts = alts ? union(alts, composed) : composed
                }
                if (!alts) alts = alternatives(opaque.value, opaque.ctx, depth + 1, seen, LOOKUP_OBJECT)
                axisAlts.set(opaque.value, alts)
                out = product(out, alts)
            }
        } else if (key === 'compoundVariants') {
            compounds = resolveToArrayLiteral(field, fieldCtx, depth, seen)
        }
        // `defaultVariants` names keys, not classes — nothing to read.
    }

    // A compound entry's classes apply ONLY for the selection it names, so they
    // co-apply with THOSE axis options and nothing else. Producting each
    // compound against every alternative of every axis discarded that
    // constraint and stacked a compound weight onto a token from a sibling
    // option the compound never applies to.
    const compoundCtx = compounds ? { ...ctx, scopes: compounds.scopes } : ctx
    const compoundCombinations = []
    for (const entry of compounds?.elements ?? []) {
        const compound = resolveToObjectLiteral(entry, compoundCtx, depth, seen)
        if (!compound) continue
        const entryCtx = { ...ctx, scopes: compound.scopes }
        let classes = NOTHING
        // axis name → option name → that option's class alternatives.
        //
        // Correlated per OPTION, not collapsed into one product: two compounds
        // sharing an axis co-apply only on the options they share, and a
        // collapsed union paired each compound's FULL selection — reporting a
        // stack across two options that never fire together.
        const axisOptions = new Map()
        // A selector resolved to NO options can never match, so the compound's
        // classes never render alongside anything.
        let impossible = false
        const compoundFields = objectFields(compound, entryCtx, depth, seen)
        // An entry spread in from something unreadable carries both the selector
        // and the classes. It names neither, so the entry cannot be pinned to an
        // axis from it — its classes compose against every axis instead, which
        // over-counts rather than losing the stack entirely.
        for (const opaque of opaqueFields(compoundFields)) {
            if (!opaque.value) continue
            const candidates = resolveToObjectLiterals(opaque.value, opaque.ctx, depth, seen)
            let fromSpread = null
            for (const candidate of candidates) {
                // An ENTRY: only its `class` field renders, and it renders in
                // BUILDER mode so `class: ['a', 'b']` composes. Reading the whole
                // entry in lookup mode unioned its fields, which made two classes
                // cva renders together look mutually exclusive.
                const composed = compoundEntryClasses(candidate, { ...ctx, scopes: candidate.scopes }, depth + 1, seen)
                fromSpread = fromSpread ? union(fromSpread, composed) : composed
            }
            if (!fromSpread) {
                fromSpread = alternatives(opaque.value, opaque.ctx, depth + 1, seen, LOOKUP_OBJECT)
            }
            classes = product(classes, fromSpread)
        }
        for (const prop of effectiveFields(compoundFields)) {
            const name = prop.key
            const field = { initializer: prop.value }
            // Each flattened field carries the scopes it was WRITTEN in — a
            // spread from a module-level `const C` means the module's bindings,
            // and evaluating its `class` against the call site picked up a
            // function-local namesake instead.
            const fieldCtx = prop.ctx
            if (name === 'class' || name === 'className') {
                classes = product(classes, alternatives(field.initializer, fieldCtx, depth + 1, seen, BUILDER_OBJECT))
                continue
            }
            // A selector names an axis and the option(s) it fires for — cva
            // accepts a list, meaning "any of these". Pull in exactly those
            // options, unioned; a selector we cannot read down to named options
            // (a boolean, a computed name) leaves the axis unpinned below, which
            // reads as "any option" — over-counting, the safe direction.
            const optionNames = selectorOptionNames(field.initializer, fieldCtx, depth, seen)
            if (optionNames !== null && optionNames.length === 0) {
                impossible = true
                break
            }
            if (name === null || optionNames === null || !variants) continue
            const axis = propertyByName(variants.node, name, { ...ctx, scopes: variants.scopes }, depth, seen)
            if (!axis) continue
            const byOption = new Map()
            for (const optionName of optionNames) {
                // EVERY value the option can hold, not just the winner: a
                // dynamic key in the axis table can alias this option, so
                // committing to the spelled-out one reports a class list the
                // selection can produce a different one of.
                const found = propertiesByName(axis.value, optionName, { ...ctx, scopes: axis.scopes }, depth, seen)
                if (found.values.length === 0) continue
                byOption.set(optionName, unionOfSelected(found.values, ctx, depth, seen))
            }
            if (byOption.size === 0) continue
            axisOptions.set(name, byOption)
        }
        // base + the pinned options + EVERY axis the compound leaves free + the
        // compound's own classes. The free axes have to stay in: a compound that
        // only constrains `size` still renders beside whatever `tone` is set to,
        // so its classes really do land next to every `tone` option's classes.
        //
        // Built from `baseAlts`, never from `out`: by now `out` carries every
        // axis unioned together, so producting against it would put the compound
        // weight back beside a sibling option of a PINNED axis — the exact
        // constraint this loop exists to respect.
        if (impossible) continue
        compoundCombinations.push({ axisOptions, classes })
    }

    // A compound renders beside base, the options it pins, and every axis it
    // leaves free — a compound constraining only `size` still lands next to
    // whatever `tone` is set to.
    //
    // Built from `baseAlts`, never from `out`: by now `out` carries every axis
    // unioned together, so producting against it would put a compound's weight
    // beside a sibling option of an axis it PINS — the constraint this whole
    // section exists to respect.
    /** One axis's classes, restricted to a subset of its options when given one. */
    const unionOptions = (byOption, only) => {
        let combined = null
        for (const [optionName, alts] of byOption) {
            if (only && !only.has(optionName)) continue
            combined = combined ? union(combined, alts) : alts
        }
        return combined ?? NOTHING
    }
    const withFreeAxes = (constrained, base) => {
        let combination = base
        for (const [axisName, alts] of axisAlts) {
            if (constrained.has(axisName)) continue
            combination = product(combination, alts)
        }
        return combination
    }
    for (const entry of compoundCombinations) {
        let combination = baseAlts
        for (const byOption of entry.axisOptions.values()) combination = product(combination, unionOptions(byOption))
        out = union(out, withFreeAxes(entry.axisOptions, product(combination, entry.classes)))
    }

    // Two compounds DO co-apply when a single selection satisfies both — the
    // ordinary case being compounds that constrain different axes. Producting
    // every compound together instead treated `{ tone: 'loud' }` and
    // `{ tone: 'quiet' }` as simultaneous, which no runtime selection can be.
    //
    // Pairs are enough, and bounded. A larger co-applying set is only realizable
    // when every pair inside it is, so any token/weight pair this metric asks
    // about already shows up in some compatible PAIR (or in one compound alone,
    // covered above).
    for (let i = 0; i < compoundCombinations.length; i++) {
        for (let j = i + 1; j < compoundCombinations.length; j++) {
            const a = compoundCombinations[i]
            const b = compoundCombinations[j]
            const axes = new Set([...a.axisOptions.keys(), ...b.axisOptions.keys()])
            let combination = baseAlts
            let compatible = true
            for (const axisName of axes) {
                const fromA = a.axisOptions.get(axisName)
                const fromB = b.axisOptions.get(axisName)
                if (fromA && fromB) {
                    // A shared axis fires both compounds only on the options they
                    // agree on. Taking each compound's whole selection instead
                    // paired an option of one with a DIFFERENT option of the
                    // other — a stack no single selection produces.
                    const shared = new Set([...fromA.keys()].filter((option) => fromB.has(option)))
                    if (shared.size === 0) {
                        compatible = false
                        break
                    }
                    combination = product(combination, unionOptions(fromA, shared))
                } else {
                    combination = product(combination, unionOptions(fromA ?? fromB))
                }
            }
            if (!compatible) continue
            out = union(out, withFreeAxes(axes, product(combination, product(a.classes, b.classes))))
        }
    }
    return out
}

/**
 * EVERY object literal an expression can denote, with each one's scope chain.
 *
 * `resolveToObjectLiteral` answers "which one is it", which a conditional has no
 * answer to. A cva table spread in from `cond ? A : {}` is one of A or nothing,
 * and each candidate has to be composed under cva's own semantics — products
 * across axes, a compound's classes against the options it pins. Unioning the
 * spread's values instead flattened all of that into "one of these classes",
 * which is why two axes hidden behind one spread never producted and an
 * array-valued compound `class` read as mutually exclusive.
 */
function resolveToObjectLiterals(node, ctx, depth, seen, into = []) {
    if (!node || depth > MAX_DEPTH || into.length > 8) return into
    if (ts.isObjectLiteralExpression(node)) {
        into.push({ node, scopes: ctx.scopes })
        return into
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return resolveToObjectLiterals(node.expression, ctx, depth + 1, seen, into)
    }
    if (ts.isConditionalExpression(node)) {
        resolveToObjectLiterals(node.whenTrue, ctx, depth + 1, seen, into)
        return resolveToObjectLiterals(node.whenFalse, ctx, depth + 1, seen, into)
    }
    if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
            node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
        resolveToObjectLiterals(node.left, ctx, depth + 1, seen, into)
        return resolveToObjectLiterals(node.right, ctx, depth + 1, seen, into)
    }
    if (ts.isIdentifier(node)) {
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound.value === OPAQUE || seen.has(bound.value)) return into
        const next = new Set(seen)
        next.add(bound.value)
        return resolveToObjectLiterals(bound.value, { ...ctx, scopes: bound.scopes }, depth + 1, next, into)
    }
    return into
}

/**
 * Resolve an expression to the array literal it denotes, WITH the scope chain
 * that literal was written in — see {@link resolveToObjectLiteral}.
 */
function resolveToArrayLiteral(node, ctx, depth, seen) {
    if (!node || depth > MAX_DEPTH) return null
    if (ts.isArrayLiteralExpression(node)) return { elements: [...node.elements], scopes: ctx.scopes }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return resolveToArrayLiteral(node.expression, ctx, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound.value === OPAQUE || seen.has(bound.value)) return null
        const next = new Set(seen)
        next.add(bound.value)
        return resolveToArrayLiteral(bound.value, { ...ctx, scopes: bound.scopes }, depth + 1, next)
    }
    return null
}

/**
 * One element of a resolved array, as `{ value, scopes }`.
 *
 * Refuses when a spread sits at or before the index: `[...REST, 'x'][1]` is only
 * position 1 if REST has exactly one entry, and guessing puts the wrong element
 * under a constant index. The caller then falls back to the whole-array union.
 */
function elementByIndex(node, index, ctx, depth, seen) {
    if (!Number.isInteger(index) || index < 0) return null
    const table = resolveToArrayLiteral(node, ctx, depth, seen)
    if (!table) return null
    // Any spread at or before the index — and, when the index is past the end,
    // any spread at all — could be supplying that position.
    const upto = Math.min(index, table.elements.length - 1)
    for (let i = 0; i <= upto; i++) if (ts.isSpreadElement(table.elements[i])) return null
    const element = table.elements[index]
    // Resolved, and nothing is there: `['a'][1]` renders no class at all, so
    // unioning the array would borrow one from an entry the index cannot reach.
    if (!element || ts.isOmittedExpression(element)) return { value: null, scopes: table.scopes }
    return { value: element, scopes: table.scopes }
}

/**
 * Bindings a scope introduces.
 *
 * EVERY declaration is recorded, including ones we refuse to inline. A binding
 * that is merely absent from the map falls through to an outer scope — which is
 * how a function parameter named `style` resolved to an unrelated module-level
 * `const style` and reported a stack the parameter never carries. Only `const`
 * initializers are inlined; parameters, `let`, `var` and function names are
 * recorded as OPAQUE, which stops the walk without inventing a value.
 */
/** Every name a binding pattern introduces — `const { a, b: [c] } = x`. */
function patternNames(name, into) {
    if (ts.isIdentifier(name)) {
        into.push(name.text)
        return
    }
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
        for (const el of name.elements) if (ts.isBindingElement(el)) patternNames(el.name, into)
    }
}

/** Record a declaration list's names, inlining only a plain `const x = <expr>`. */
function recordDeclarationList(list, bindings) {
    const isConst = !!(list.flags & ts.NodeFlags.Const)
    for (const decl of list.declarations) {
        if (ts.isIdentifier(decl.name)) {
            bindings.set(decl.name.text, isConst && decl.initializer ? decl.initializer : OPAQUE)
            continue
        }
        // Destructuring binds real names we cannot resolve a value for. Recording
        // them OPAQUE is the whole point: a name merely ABSENT from the map falls
        // through to an outer scope, which is how `const { style } = props`
        // resolved to an unrelated module-level `const style`.
        const names = []
        patternNames(decl.name, names)
        for (const bound of names) bindings.set(bound, OPAQUE)
    }
}

function declarationBindings(statements) {
    const bindings = new Map()
    for (const statement of statements ?? []) {
        if (ts.isVariableStatement(statement)) {
            recordDeclarationList(statement.declarationList, bindings)
        } else if (ts.isFunctionDeclaration(statement) && statement.name) {
            bindings.set(statement.name.text, OPAQUE)
        } else if (ts.isClassDeclaration(statement) && statement.name) {
            bindings.set(statement.name.text, OPAQUE)
        } else if (ts.isEnumDeclaration(statement) && statement.name) {
            // A runtime enum is a real value binding: `enum style { A }` shadows
            // an outer `const style`, and the object it names carries no classes.
            bindings.set(statement.name.text, OPAQUE)
        } else if (ts.isModuleDeclaration(statement) && statement.name && ts.isIdentifier(statement.name)) {
            bindings.set(statement.name.text, OPAQUE)
        } else if (ts.isImportDeclaration(statement)) {
            const clause = statement.importClause
            if (clause?.name) bindings.set(clause.name.text, OPAQUE)
            const named = clause?.namedBindings
            if (named && ts.isNamedImports(named)) {
                for (const el of named.elements) bindings.set(el.name.text, OPAQUE)
            } else if (named && ts.isNamespaceImport(named)) {
                bindings.set(named.name.text, OPAQUE)
            }
        }
    }
    return bindings
}

/** Parameter names of a function-like node, all OPAQUE — they shadow, they never inline. */
function parameterBindings(node) {
    const bindings = new Map()
    const record = (name) => {
        if (ts.isIdentifier(name)) {
            bindings.set(name.text, OPAQUE)
        } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
            for (const el of name.elements) if (ts.isBindingElement(el)) record(el.name)
        }
    }
    for (const param of node.parameters ?? []) record(param.name)
    return bindings
}

/**
 * `var` names declared ANYWHERE inside a function body, without descending into
 * nested functions.
 *
 * `var` is function-scoped, but the collector only read a scope's direct
 * statements — so a `var style` inside an `if` block vanished once that block
 * was popped, and a call after it resolved `style` to an unrelated outer const.
 * The binding is real for the whole function, so it has to be recorded there.
 */
function hoistedVarNames(body) {
    const names = []
    const walk = (node) => {
        // A class static block is its own var scope, exactly as a nested
        // function is — descending into one marked the ENCLOSING function's
        // binding opaque and hid a name that really was readable.
        if (isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node)) return
        // A `for (var x …)` header declares a function-scoped binding just as a
        // statement does, and reading only VariableStatement missed every one.
        const list = ts.isVariableStatement(node)
            ? node.declarationList
            : (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) &&
                node.initializer &&
                ts.isVariableDeclarationList(node.initializer)
              ? node.initializer
              : null
        if (list) {
            const isVar = !(list.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))
            if (isVar) for (const decl of list.declarations) patternNames(decl.name, names)
        }
        ts.forEachChild(node, walk)
    }
    ts.forEachChild(body, walk)
    return names
}

function isFunctionLike(node) {
    return (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)
    )
}

function statementScope(node) {
    return ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) || ts.isCaseBlock(node)
}

/**
 * Bindings introduced by a node that is not a statement list: loop heads, catch
 * clauses, and the self-name of a named function or class EXPRESSION.
 *
 * All OPAQUE. They exist purely to stop resolution walking past them to an outer
 * const of the same name — a shadow the scanner does not record is a shadow it
 * silently ignores.
 */
function otherScopeBindings(node) {
    const bindings = new Map()
    if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
        const init = ts.isForStatement(node) ? node.initializer : node.initializer
        if (init && ts.isVariableDeclarationList(init)) {
            const names = []
            for (const decl of init.declarations) patternNames(decl.name, names)
            for (const bound of names) bindings.set(bound, OPAQUE)
        }
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
        const names = []
        patternNames(node.variableDeclaration.name, names)
        for (const bound of names) bindings.set(bound, OPAQUE)
    } else if ((ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name) {
        bindings.set(node.name.text, OPAQUE)
    }
    return bindings
}

/**
 * Every distinct token+weight stack in a file, as dedupe keys.
 *
 * Keyed on the source positions of the literals that produced the pair rather
 * than per class list: a drifted constant read in five places is one thing to
 * fix, and it also collapses the natural overlap between producers (a builder
 * call nested inside a className attribute is reached twice).
 *
 * Returns `null` when the source does not parse cleanly, so the caller can fall
 * back rather than trust a recovered tree.
 */
function weightStackSites(text, filename, { isToken, isWeight }) {
    // Script kind by extension. TSX is not a superset: in a .ts file `<T>value`
    // is a type assertion and `<T,>(x) => x` a generic arrow, and parsing those
    // as TSX yields syntax errors on perfectly good source.
    const kind = filename.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX
    const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, kind)
    // `createSourceFile` does not throw on a syntax error — it recovers, and the
    // recovered tree can be missing whole statements the source really has. A
    // scanner that walked one of those would under-report on exactly the files
    // it could not read, which is a ratchet with the tension quietly let out.
    const diagnostics = source.parseDiagnostics
    if (!Array.isArray(diagnostics) || diagnostics.length > 0) return null

    const ctx = { scopes: [], isToken, isWeight }
    const sites = new Set()
    const record = (alts) => {
        for (const alt of alts) if (isMatch(alt)) sites.add(altKey(alt))
    }

    const visit = (node) => {
        const scopes = []
        if (statementScope(node)) {
            // A CaseBlock holds CLAUSES, not statements, and a braceless
            // `case x: const style = …` declares into the switch's own scope. The
            // statement collector saw nothing there, so the name never shadowed.
            const statements = ts.isCaseBlock(node)
                ? node.clauses.flatMap((clause) => [...(clause.statements ?? [])])
                : node.statements
            scopes.push(declarationBindings(statements))
        }
        // Parameter defaults are evaluated in the PARAMETER environment, which
        // cannot see the body's hoisted `var`s — `function f(x = style) { var
        // style }` reads the outer `style`. Installing the body vars for the
        // whole function node shadowed it and lost a real finding, so the
        // parameters are walked under the parameter scope alone and the body
        // vars are added afterwards, for the body's own traversal.
        let hoistedScope = null
        if (isFunctionLike(node)) {
            scopes.push(parameterBindings(node))
            const hoisted = node.body ? hoistedVarNames(node.body) : []
            if (hoisted.length > 0) {
                hoistedScope = new Map()
                for (const name of hoisted) hoistedScope.set(name, OPAQUE)
            }
        }
        const other = otherScopeBindings(node)
        if (other.size > 0) scopes.push(other)
        for (const scope of scopes) ctx.scopes.push(scope)

        if (ts.isJsxAttribute(node) && node.name && isClassNameProp(node.name.getText(source))) {
            const init = node.initializer
            const expr = init && ts.isJsxExpression(init) ? init.expression : init
            if (expr) record(alternatives(expr, ctx))
        } else if (ts.isCallExpression(node)) {
            const name = calleeName(node)
            if (name && BUILDERS.has(name)) record(alternatives(node, ctx))
        } else if (ts.isVariableDeclaration(node) && node.initializer) {
            record(alternatives(node.initializer, ctx))
        } else if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
            record(alternatives(node, ctx))
        }
        if (hoistedScope) {
            for (const parameter of node.parameters ?? []) visit(parameter)
            ctx.scopes.push(hoistedScope)
            ts.forEachChild(node, (child) => {
                if (!(node.parameters ?? []).includes(child)) visit(child)
            })
            ctx.scopes.pop()
        } else {
            ts.forEachChild(node, visit)
        }

        for (let i = 0; i < scopes.length; i++) ctx.scopes.pop()
    }
    visit(source)

    return sites
}

module.exports = { weightStackSites, BUILDERS, OPAQUE }
