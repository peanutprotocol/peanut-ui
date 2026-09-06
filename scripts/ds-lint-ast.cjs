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

/** Innermost lexical binding for a name — OPAQUE stops the walk, it does not fall through. */
function lookup(scopes, name) {
    for (let i = scopes.length - 1; i >= 0; i--) {
        if (scopes[i].has(name)) return scopes[i].get(name)
    }
    return undefined
}

function resolveToObjectLiteral(node, ctx, depth, seen) {
    if (!node || depth > MAX_DEPTH) return null
    if (ts.isObjectLiteralExpression(node)) return node
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return resolveToObjectLiteral(node.expression, ctx, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        if (seen.has(node.text)) return null
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound === OPAQUE) return null
        const next = new Set(seen)
        next.add(node.text)
        return resolveToObjectLiteral(bound, ctx, depth + 1, next)
    }
    return null
}

function propertyByName(node, name, ctx, depth, seen) {
    const target = resolveToObjectLiteral(node, ctx, depth, seen)
    if (!target) return null
    // Later properties win, so walk backwards — and follow spreads, since
    // `{ ...BASE }` really does carry BASE's keys.
    for (let i = target.properties.length - 1; i >= 0; i--) {
        const prop = target.properties[i]
        if (ts.isSpreadAssignment(prop)) {
            const fromSpread = propertyByName(prop.expression, name, ctx, depth + 1, seen)
            if (fromSpread) return fromSpread
            continue
        }
        if (!ts.isPropertyAssignment(prop)) continue
        const key = prop.name
        const keyText = ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : null
        if (keyText === name) return prop.initializer
    }
    return null
}

/**
 * Does the join between two concatenated fragments actually separate class
 * names? Only a trailing space on the left or a leading space on the right does.
 * A fragment we cannot read statically is assumed to separate — over-counting is
 * the safe direction for a debt ratchet.
 */
function concatBoundarySeparates(left, right) {
    const tail = staticText(left)
    const head = staticText(right)
    if (tail === null || head === null) return true
    return /\s$/.test(tail) || /^\s/.test(head) || tail === '' || head === ''
}

/** The literal text of an expression, or null when it is not statically known. */
function staticText(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    if (ts.isTemplateExpression(node)) return null
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        return staticText(node.right)
    }
    return null
}

function literalAlt(node, text, ctx) {
    const pos = startOf(node)
    return [{ token: ctx.isToken(text) ? pos : null, weight: ctx.isWeight(text) ? pos : null }]
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
            // `+` GLUES. `'text-body-m' + 'font-semibold'` renders the single
            // class `text-body-mfont-semibold` — not a token beside a weight —
            // so composing across a boundary that does not separate class names
            // reports a stack no element receives. Only concatenation with a
            // real whitespace boundary composes.
            if (!concatBoundarySeparates(node.left, node.right)) return NOTHING
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
                if (!ts.isPropertyAssignment(prop)) continue
                const key = prop.name
                if (ts.isStringLiteral(key) || ts.isIdentifier(key)) {
                    out = product(out, literalAlt(key, key.text, ctx))
                }
                out = product(out, alternatives(prop.initializer, ctx, depth + 1, seen, mode))
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
            const isWhitespace =
                sep !== undefined &&
                (ts.isStringLiteral(sep) || ts.isNoSubstitutionTemplateLiteral(sep)) &&
                sep.text.length > 0 &&
                sep.text.trim() === ''
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
        const selected = propertyByName(node.expression, node.name.text, ctx, depth, seen)
        if (selected) return alternatives(selected, ctx, depth + 1, seen, LOOKUP_OBJECT)
        return alternatives(node.expression, ctx, depth + 1, seen, LOOKUP_OBJECT)
    }
    if (ts.isElementAccessExpression(node)) {
        const arg = node.argumentExpression
        if (arg && ts.isStringLiteral(arg)) {
            const selected = propertyByName(node.expression, arg.text, ctx, depth, seen)
            if (selected) return alternatives(selected, ctx, depth + 1, seen, LOOKUP_OBJECT)
        }
        return alternatives(node.expression, ctx, depth + 1, seen, LOOKUP_OBJECT)
    }
    if (ts.isIdentifier(node)) {
        if (seen.has(node.text)) return NOTHING
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound === OPAQUE) return NOTHING
        const next = new Set(seen)
        next.add(node.text)
        return alternatives(bound, ctx, depth + 1, next, mode)
    }
    return NOTHING
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
    let out = baseAlts
    if (!config) return out

    const configObject = resolveToObjectLiteral(config, ctx, depth, seen)
    if (!configObject) return product(out, alternatives(config, ctx, depth + 1, seen, BUILDER_OBJECT))

    let variants = null
    let compounds = null
    for (const prop of configObject.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null

        if (key === 'variants') {
            variants = resolveToObjectLiteral(prop.initializer, ctx, depth, seen)
            if (!variants) continue
            for (const axis of variants.properties) {
                if (!ts.isPropertyAssignment(axis)) continue
                // union WITHIN the axis, product ACROSS axes
                out = product(out, alternatives(axis.initializer, ctx, depth + 1, seen, LOOKUP_OBJECT))
            }
        } else if (key === 'compoundVariants') {
            compounds = resolveToArrayLiteral(prop.initializer, ctx, depth, seen)
        }
        // `defaultVariants` names keys, not classes — nothing to read.
    }

    // A compound entry's classes apply ONLY for the selection it names, so they
    // co-apply with THOSE axis options and nothing else. Producting each
    // compound against every alternative of every axis discarded that
    // constraint and stacked a compound weight onto a token from a sibling
    // option the compound never applies to.
    for (const entry of compounds ?? []) {
        const compound = resolveToObjectLiteral(entry, ctx, depth, seen)
        if (!compound) continue
        let selected = NOTHING
        let classes = NOTHING
        for (const field of compound.properties) {
            if (!ts.isPropertyAssignment(field)) continue
            const name = ts.isIdentifier(field.name) || ts.isStringLiteral(field.name) ? field.name.text : null
            if (name === 'class' || name === 'className') {
                classes = product(classes, alternatives(field.initializer, ctx, depth + 1, seen, BUILDER_OBJECT))
                continue
            }
            // A selector names an axis and the option it fires for. Pull that ONE
            // option's classes in; an unreadable selector contributes nothing
            // rather than the whole axis.
            const optionName = staticText(field.initializer)
            if (name === null || optionName === null || !variants) continue
            const axis = propertyByName(variants, name, ctx, depth, seen)
            if (!axis) continue
            const option = propertyByName(axis, optionName, ctx, depth, seen)
            if (option) selected = product(selected, alternatives(option, ctx, depth + 1, seen, LOOKUP_OBJECT))
        }
        // base + the SELECTED options + the compound's own classes.
        //
        // Built from `baseAlts`, never from `out`: by now `out` carries every
        // axis unioned together, so producting against it would put the compound
        // weight back beside a sibling option it never applies to — the exact
        // constraint this loop exists to respect.
        out = union(out, product(product(baseAlts, selected), classes))
    }
    return out
}

/** Resolve an expression to an array literal, following same-file consts. */
function resolveToArrayLiteral(node, ctx, depth, seen) {
    if (!node || depth > MAX_DEPTH) return null
    if (ts.isArrayLiteralExpression(node)) return [...node.elements]
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return resolveToArrayLiteral(node.expression, ctx, depth + 1, seen)
    }
    if (ts.isIdentifier(node)) {
        if (seen.has(node.text)) return null
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound === OPAQUE) return null
        const next = new Set(seen)
        next.add(node.text)
        return resolveToArrayLiteral(bound, ctx, depth + 1, next)
    }
    return null
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
    // eslint-disable-next-line no-bitwise
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
        if (isFunctionLike(node)) return
        if (ts.isVariableStatement(node)) {
            // eslint-disable-next-line no-bitwise
            const isVar = !(node.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))
            if (isVar) for (const decl of node.declarationList.declarations) patternNames(decl.name, names)
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
        if (statementScope(node)) scopes.push(declarationBindings(node.statements))
        if (isFunctionLike(node)) {
            const fnScope = parameterBindings(node)
            if (node.body) for (const name of hoistedVarNames(node.body)) fnScope.set(name, OPAQUE)
            scopes.push(fnScope)
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
        ts.forEachChild(node, visit)

        for (let i = 0; i < scopes.length; i++) ctx.scopes.pop()
    }
    visit(source)

    return sites
}

module.exports = { weightStackSites, BUILDERS, OPAQUE }
