// Bounded, same-file class-expression evaluation. See ds-lint-contract.md.
const ts = require('typescript')
const BUILDERS = new Set(['twMerge', 'clsx', 'cn', 'classNames', 'tw'])
const OPAQUE = Symbol('opaque-binding')
const UNKNOWN = Symbol('unknown-value')
const NEGATIVE_ZERO = Symbol('negative-zero')
const primitiveKey = (value) => (Object.is(value, -0) ? NEGATIVE_ZERO : value)
const distinctPrimitives = (values) => [...new Map(values.map((value) => [primitiveKey(value), value])).values()]
const NOTHING = [{ token: null, weight: null }]
const MAX_CHOICES = 256
const MAX_TEXT = 65536
const MAX_WORK = 100000
const MAX_DEPTH = 256

class AnalysisError extends Error {
    constructor(code, node, ctx, message) {
        const source = ctx.source
        const pos = source.getLineAndCharacterOfPosition(node.getStart(source))
        super(`${source.fileName}:${pos.line + 1}:${pos.character + 1}: ${code}: ${message}`)
        this.name = 'AnalysisError'
        this.code = code
    }
}
function consume(node, ctx, depth, work = 1) {
    ctx.budget.remaining -= work
    if (depth > MAX_DEPTH || ctx.budget.remaining < 0) {
        throw new AnalysisError(
            'ANALYSIS_LIMIT',
            node,
            ctx,
            'Class analysis exceeded its work/depth limit; simplify the expression before ratcheting'
        )
    }
}
function bounded(values, node, ctx) {
    if (values.length > MAX_CHOICES) {
        throw new AnalysisError(
            'ANALYSIS_LIMIT',
            node,
            ctx,
            'More than 256 structural or string alternatives; simplify the expression before ratcheting'
        )
    }
    return values
}
function lookup(scopes, name) {
    for (let i = scopes.length - 1; i >= 0; i--) {
        if (scopes[i].has(name)) return { value: scopes[i].get(name), scopes: scopes.slice(0, i + 1) }
    }
}
function transparent(node) {
    return (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isNonNullExpression(node)
    )
}
function ref(node, ctx, seen = new Set()) {
    return { node, ctx, seen }
}

// The same resolver is used by classes, primitives, keys, guards, objects and
// arrays. A branch is always a choice; only builder arguments/array items co-apply.
function resolve(input, depth = 0) {
    const { node, ctx, seen } = input
    if (!node) return []
    if (input.absent || input.unknown || Object.hasOwn(input, 'scalar')) return [input]
    consume(node, ctx, depth)
    if (transparent(node)) return resolve(ref(node.expression, ctx, seen), depth + 1)
    if (ts.isIdentifier(node)) {
        const bound = lookup(ctx.scopes, node.text)
        if (!bound || bound.value === OPAQUE || seen.has(bound.value)) return [input]
        const next = new Set(seen)
        next.add(bound.value)
        return resolve(ref(bound.value, { ...ctx, scopes: bound.scopes }, next), depth + 1)
    }
    if (ts.isConditionalExpression(node)) {
        const condition = truth(ref(node.condition, ctx, seen), depth + 1)
        if (condition !== UNKNOWN) return resolve(ref(condition ? node.whenTrue : node.whenFalse, ctx, seen), depth + 1)
        return [
            ...resolve(ref(node.whenTrue, ctx, seen), depth + 1),
            ...resolve(ref(node.whenFalse, ctx, seen), depth + 1),
        ]
    }
    if (ts.isBinaryExpression(node)) {
        const op = node.operatorToken.kind
        if (
            [
                ts.SyntaxKind.AmpersandAmpersandToken,
                ts.SyntaxKind.BarBarToken,
                ts.SyntaxKind.QuestionQuestionToken,
            ].includes(op)
        ) {
            const left = ref(node.left, ctx, seen)
            const condition =
                op === ts.SyntaxKind.QuestionQuestionToken ? nullish(left, depth + 1) : truth(left, depth + 1)
            if (condition !== UNKNOWN) {
                const takeRight =
                    op === ts.SyntaxKind.AmpersandAmpersandToken
                        ? condition
                        : op === ts.SyntaxKind.BarBarToken
                          ? !condition
                          : condition
                return resolve(takeRight ? ref(node.right, ctx, seen) : left, depth + 1)
            }
            // The value of && on its left path is falsy, so it emits no class.
            const lhs =
                op === ts.SyntaxKind.AmpersandAmpersandToken ? [{ ...left, absent: true }] : resolve(left, depth + 1)
            return [...lhs, ...resolve(ref(node.right, ctx, seen), depth + 1)]
        }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
        return select(input, depth + 1).flatMap((selected) => resolve(selected, depth + 1))
    return [input]
}

function primitive(input, depth = 0) {
    const values = primitiveChoices(input, depth)
    if (!values.complete || !values.values.length) return UNKNOWN
    const first = values.values[0]
    return values.values.every((v) => Object.is(v, first)) ? first : UNKNOWN
}
function predicate(input, depth, test) {
    const values = resolve(input, depth + 1)
    let result
    for (const value of values) {
        const node = value.node
        let answer
        if (
            ts.isObjectLiteralExpression(node) ||
            ts.isArrayLiteralExpression(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node) ||
            ts.isClassExpression(node) ||
            ts.isRegularExpressionLiteral(node) ||
            ts.isNewExpression(node) ||
            (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
        ) {
            answer = test === 'truth' // objects are truthy and never nullish
        } else {
            const scalar = primitiveLeaf(value, depth + 1)
            if (!scalar.complete || !scalar.values.length) return UNKNOWN
            const outcomes = scalar.values.map((v) => (test === 'truth' ? Boolean(v) : v == null))
            if (!outcomes.every((outcome) => outcome === outcomes[0])) return UNKNOWN
            answer = outcomes[0]
        }
        if (result !== undefined && result !== answer) return UNKNOWN
        result = answer
    }
    return result ?? UNKNOWN
}
const truth = (input, depth) => predicate(input, depth, 'truth')
const nullish = (input, depth) => predicate(input, depth, 'nullish')

const unknownPrimitive = () => ({ values: [], complete: false })
function primitiveChoices(input, depth = 0) {
    const out = { values: [], complete: true }
    for (const candidate of resolve(input, depth + 1)) {
        const part = primitiveLeaf(candidate, depth + 1)
        out.values.push(...part.values)
        out.complete &&= part.complete
        out.values = distinctPrimitives(out.values)
        bounded(out.values, input.node, input.ctx)
    }
    return out
}
function combinePrimitives(left, right, fn, input) {
    if (!left.complete || !right.complete) return unknownPrimitive()
    const values = new Map()
    for (const a of left.values)
        for (const b of right.values) {
            consume(input.node, input.ctx, 0)
            // Bound input text before concatenation can allocate its output.
            if ((typeof a === 'string' ? a.length : 0) + (typeof b === 'string' ? b.length : 0) > MAX_TEXT) {
                throw new AnalysisError(
                    'ANALYSIS_LIMIT',
                    input.node,
                    input.ctx,
                    'Generated class/key text exceeds 65536 characters'
                )
            }
            let value
            try {
                value = fn(a, b)
            } catch {
                return unknownPrimitive()
            }
            if (typeof value === 'string' && value.length > MAX_TEXT) {
                throw new AnalysisError(
                    'ANALYSIS_LIMIT',
                    input.node,
                    input.ctx,
                    'Generated class/key text exceeds 65536 characters'
                )
            }
            values.set(primitiveKey(value), value)
            bounded([...values.values()], input.node, input.ctx)
        }
    return { values: [...values.values()], complete: true }
}
function primitiveLeaf(input, depth) {
    const { node, ctx, seen } = input
    consume(node, ctx, depth)
    const known = (value) => ({ values: [value], complete: true })
    if (input.absent) return known(false)
    if (Object.hasOwn(input, 'scalar')) return known(input.scalar)
    if (input.unknown) return unknownPrimitive()
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return known(node.text)
    if (ts.isNumericLiteral(node)) return known(Number(node.text))
    if (ts.isBigIntLiteral(node)) return known(BigInt(node.text.replace(/n$/, '')))
    if (node.kind === ts.SyntaxKind.TrueKeyword) return known(true)
    if (node.kind === ts.SyntaxKind.FalseKeyword) return known(false)
    if (node.kind === ts.SyntaxKind.NullKeyword) return known(null)
    if (ts.isIdentifier(node) && !lookup(ctx.scopes, node.text)) {
        if (node.text === 'undefined') return known(undefined)
        if (node.text === 'NaN') return known(NaN)
        if (node.text === 'Infinity') return known(Infinity)
    }
    if (ts.isPrefixUnaryExpression(node)) {
        if (node.operator === ts.SyntaxKind.ExclamationToken) {
            const value = truth(ref(node.operand, ctx, seen), depth + 1)
            if (value !== UNKNOWN) return known(!value)
        }
        const inner = primitiveChoices(ref(node.operand, ctx, seen), depth + 1)
        const unary = {
            [ts.SyntaxKind.PlusToken]: (v) => +v,
            [ts.SyntaxKind.MinusToken]: (v) => -v,
            [ts.SyntaxKind.ExclamationToken]: (v) => !v,
            [ts.SyntaxKind.TildeToken]: (v) => ~v,
        }[node.operator]
        if (unary && inner.complete) {
            try {
                return { values: distinctPrimitives(inner.values.map(unary)), complete: true }
            } catch {
                return unknownPrimitive()
            }
        }
    }
    if (ts.isVoidExpression(node)) return known(undefined)
    if (ts.isBinaryExpression(node)) {
        const op = {
            [ts.SyntaxKind.PlusToken]: (a, b) => a + b,
            [ts.SyntaxKind.MinusToken]: (a, b) => a - b,
            [ts.SyntaxKind.AsteriskToken]: (a, b) => a * b,
            [ts.SyntaxKind.SlashToken]: (a, b) => a / b,
            [ts.SyntaxKind.PercentToken]: (a, b) => a % b,
            [ts.SyntaxKind.EqualsEqualsEqualsToken]: (a, b) => a === b,
            [ts.SyntaxKind.ExclamationEqualsEqualsToken]: (a, b) => a !== b,
            [ts.SyntaxKind.LessThanToken]: (a, b) => a < b,
            [ts.SyntaxKind.GreaterThanToken]: (a, b) => a > b,
        }[node.operatorToken.kind]
        if (op)
            return combinePrimitives(
                primitiveChoices(ref(node.left, ctx, seen), depth + 1),
                primitiveChoices(ref(node.right, ctx, seen), depth + 1),
                op,
                input
            )
    }
    if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'join'
    ) {
        const separator = node.arguments[0] ? primitive(ref(node.arguments[0], ctx, seen), depth + 1) : ','
        if (typeof separator === 'string' && separator.length > 0 && separator.trim() === '') {
            return joinedArrayText(ref(node.expression.expression, ctx, seen), separator, depth + 1)
        }
    }
    if (ts.isTemplateExpression(node)) {
        let out = known(node.head.text)
        for (const span of node.templateSpans) {
            out = combinePrimitives(
                out,
                primitiveChoices(ref(span.expression, ctx, seen), depth + 1),
                (a, b) => a + String(b) + span.literal.text,
                input
            )
        }
        return out
    }
    return unknownPrimitive()
}

function propertyNameText(name) {
    return ts.isBigIntLiteral(name) ? String(BigInt(name.text.replace(/n$/, ''))) : name.text
}

// Object alternatives retain field order, declaring scopes and absence. Unknown
// spreads/keys remain explicit wildcard records; they cannot prove a key absent.
function objectFields(input, depth = 0) {
    const { node, ctx, seen } = input
    consume(node, ctx, depth)
    let variants = [[]]
    for (const prop of node.properties) {
        let choices
        if (ts.isSpreadAssignment(prop)) {
            choices = []
            const spread = ref(prop.expression, ctx, seen)
            for (const candidate of resolve(spread, depth + 1)) {
                if (ts.isObjectLiteralExpression(candidate.node)) choices.push(...objectFields(candidate, depth + 1))
                else if (ts.isArrayLiteralExpression(candidate.node)) {
                    for (const items of arrayItems(candidate, depth + 1)) {
                        if (items.some((item) => item.spread))
                            choices.push([{ key: null, value: candidate, spread: true }])
                        else
                            choices.push(
                                items.flatMap((item, index) =>
                                    ts.isOmittedExpression(item.node)
                                        ? []
                                        : [{ key: String(index), value: item, origin: prop }]
                                )
                            )
                    }
                } else {
                    const scalar = primitiveLeaf(candidate, depth + 1)
                    if (scalar.complete) {
                        for (const value of scalar.values)
                            choices.push(
                                typeof value === 'string'
                                    ? value.split('').map((char, index) => ({
                                          key: String(index),
                                          value: { ...candidate, scalar: char },
                                          origin: prop,
                                      }))
                                    : []
                            )
                    } else choices.push([{ key: null, value: candidate, spread: true }])
                }
            }
            if (!choices.length) choices.push([])
        } else {
            const shorthand = ts.isShorthandPropertyAssignment(prop)
            if (!ts.isPropertyAssignment(prop) && !shorthand) {
                // Accessors/methods can override earlier data properties.
                const keys =
                    prop.name && ts.isComputedPropertyName(prop.name)
                        ? primitiveChoices(ref(prop.name.expression, ctx, seen), depth + 1)
                        : { values: prop.name ? [propertyNameText(prop.name)] : [], complete: !!prop.name }
                choices = keys.values.map((key) => [{ key: String(key), value: ref(prop, ctx, seen), origin: prop }])
                if (!keys.complete) choices.push([{ key: null, value: ref(prop, ctx, seen), origin: prop }])
            } else {
                const value = ref(shorthand ? prop.name : prop.initializer, ctx, seen)
                const name = prop.name
                if (ts.isComputedPropertyName(name)) {
                    const keys = primitiveChoices(ref(name.expression, ctx, seen), depth + 1)
                    choices = keys.values.map((key) => [{ key: String(key), value, origin: name }])
                    if (!keys.complete)
                        choices.push([
                            { key: null, value, origin: name, keyExpression: ref(name.expression, ctx, seen) },
                        ])
                } else {
                    const key = propertyNameText(name)
                    choices = [[{ key, value, origin: name }]]
                }
            }
        }
        if (choices.length === 1) {
            for (const before of variants) before.push(...choices[0])
            continue
        }
        const next = []
        for (const before of variants)
            for (const after of choices) {
                consume(node, ctx, depth)
                next.push([...before, ...after])
                bounded(next, node, ctx)
            }
        variants = next
    }
    return variants
}

function arrayItems(input, depth = 0) {
    const { node, ctx, seen } = input
    consume(node, ctx, depth)
    let variants = [[]]
    for (const element of node.elements) {
        let choices
        if (ts.isSpreadElement(element)) {
            choices = []
            for (const candidate of resolve(ref(element.expression, ctx, seen), depth + 1)) {
                if (ts.isArrayLiteralExpression(candidate.node)) choices.push(...arrayItems(candidate, depth + 1))
                else {
                    const scalar = primitiveLeaf(candidate, depth + 1)
                    if (scalar.complete && scalar.values.every((value) => typeof value === 'string')) {
                        for (const value of scalar.values)
                            choices.push([...value].map((char) => ({ ...candidate, scalar: char })))
                    } else choices.push([{ ...candidate, spread: true }])
                }
            }
        } else choices = [[ref(element, ctx, seen)]]
        if (choices.length === 1) {
            for (const before of variants) before.push(...choices[0])
            continue
        }
        const next = []
        for (const before of variants)
            for (const after of choices) {
                consume(node, ctx, depth)
                next.push([...before, ...after])
                bounded(next, node, ctx)
            }
        variants = next
    }
    return variants
}

function select(input, depth) {
    const { node, ctx, seen } = input
    const key = ts.isPropertyAccessExpression(node)
        ? { values: [node.name.text], complete: true }
        : primitiveChoices(ref(node.argumentExpression, ctx, seen), depth + 1)
    const keys = key.values.map(String)
    const missing = () => ({ ...input, scalar: undefined })
    const unknown = () => ({ ...input, unknown: true })
    const out = []
    for (const candidate of resolve(ref(node.expression, ctx, seen), depth + 1)) {
        if (ts.isObjectLiteralExpression(candidate.node)) {
            for (const fields of objectFields(candidate, depth + 1)) {
                if (!key.complete) {
                    const effective = new Map()
                    for (const field of fields) effective.set(field.key === null ? field : field.key, field)
                    out.push(...[...effective.values()].map((f) => ({ ...f.value, lookup: !!f.spread })), missing())
                }
                for (const name of keys) {
                    let definite = false
                    for (let i = fields.length - 1; i >= 0; i--) {
                        const field = fields[i]
                        if (field.key === name || field.key === null)
                            out.push({ ...field.value, lookup: !!field.spread })
                        if (field.key === name) {
                            definite = true
                            break
                        }
                    }
                    if (!definite) out.push(missing())
                }
            }
        } else if (ts.isArrayLiteralExpression(candidate.node)) {
            for (const items of arrayItems(candidate, depth + 1)) {
                const firstSpread = items.findIndex((item) => item.spread)
                if (!key.complete) out.push(...items.map((item) => ({ ...item, lookup: !!item.spread })), missing())
                for (const name of keys) {
                    if (name === 'length') {
                        out.push(firstSpread === -1 ? { ...input, scalar: items.length } : unknown())
                        continue
                    }
                    const index = Number(name)
                    if (!Number.isInteger(index) || index < 0 || index >= 4294967295 || String(index) !== name) {
                        out.push(missing())
                        continue
                    }
                    if (firstSpread !== -1 && firstSpread <= index)
                        out.push(
                            ...items.slice(firstSpread).map((item) => ({ ...item, lookup: !!item.spread })),
                            missing()
                        )
                    else out.push(items[index] && !ts.isOmittedExpression(items[index].node) ? items[index] : missing())
                }
            }
        } else out.push(unknown())
    }
    return out
}

const altKey = (alt) => `${alt.token ?? '-'}:${alt.weight ?? '-'}`
const isMatch = (alt) => alt.token !== null && alt.weight !== null
function normalize(alts) {
    const out = [...new Map(alts.map((alt) => [altKey(alt), alt])).values()]
    if (out.length <= MAX_CHOICES) return out
    // The metric deliberately retains existence, not exact fan-out cardinality.
    const kept = out.filter(isMatch),
        shapes = new Set()
    for (const alt of out) {
        if (isMatch(alt)) continue
        const shape = `${alt.token !== null}:${alt.weight !== null}`
        if (!shapes.has(shape)) {
            shapes.add(shape)
            kept.push(alt)
        }
    }
    return kept
}
function union(left, right) {
    return normalize([...left, ...right])
}
function product(left, right, input, depth) {
    consume(input.node, input.ctx, depth, left.length * right.length)
    const out = []
    for (const a of left) for (const b of right) out.push({ token: a.token ?? b.token, weight: a.weight ?? b.weight })
    return normalize(out.length ? out : NOTHING)
}
function literal(node, text, ctx, joined = false) {
    const pos = node.getStart()
    return [{ token: ctx.isToken(text, joined) ? pos : null, weight: ctx.isWeight(text, joined) ? pos : null }]
}
function summarize(input, mode, depth = 0) {
    let out = []
    for (const candidate of resolve(input, depth + 1))
        out = union(out, summarizeLeaf(candidate, candidate.lookup ? 'lookup' : mode, depth + 1))
    return out.length ? out : NOTHING
}
// Array.join stringifies its items. Nested arrays use commas regardless of the
// outer separator; objects are opaque coercions, never builder-key collections.
function joinedArrayText(input, separator, depth) {
    const out = { values: [], complete: true }
    for (const candidate of resolve(input, depth + 1)) {
        if (!ts.isArrayLiteralExpression(candidate.node)) {
            out.complete = false
            continue
        }
        for (const items of arrayItems(candidate, depth + 1)) {
            let text = { values: [''], complete: true }
            for (const [index, item] of items.entries()) {
                text = combinePrimitives(
                    text,
                    joinItemText(item, depth + 1),
                    (a, b) => a + (index ? separator : '') + b,
                    input
                )
            }
            out.values = distinctPrimitives([...out.values, ...text.values])
            out.complete &&= text.complete
            bounded(out.values, input.node, input.ctx)
        }
    }
    return out
}
function joinItemText(input, depth) {
    let out = { values: [], complete: true }
    for (const candidate of resolve(input, depth + 1)) {
        let part
        if (ts.isArrayLiteralExpression(candidate.node)) {
            part = joinedArrayText(candidate, ',', depth + 1)
        } else if (ts.isOmittedExpression(candidate.node)) {
            part = { values: [''], complete: true }
        } else {
            const scalar = primitiveLeaf(candidate, depth + 1)
            part = {
                values: scalar.values.map((value) => (value == null ? '' : String(value))),
                complete: scalar.complete,
            }
        }
        out.values = distinctPrimitives([...out.values, ...part.values])
        out.complete &&= part.complete
        bounded(out.values, input.node, input.ctx)
    }
    return out
}
function summarizeJoin(input, depth) {
    let out = []
    for (const candidate of resolve(input, depth + 1)) {
        if (!ts.isArrayLiteralExpression(candidate.node)) continue
        for (const items of arrayItems(candidate, depth + 1)) {
            let option = NOTHING
            for (const item of items) {
                const text = joinItemText(item, depth + 1)
                let alts = []
                for (const value of text.values) alts = union(alts, literal(item.node, value, item.ctx, true))
                if (!text.complete) {
                    for (const fragment of resolve(item, depth + 1)) {
                        if (ts.isArrayLiteralExpression(fragment.node) || ts.isObjectLiteralExpression(fragment.node))
                            continue
                        alts = union(alts, summarize(fragment, 'lookup', depth + 1))
                    }
                }
                option = product(option, alts.length ? alts : NOTHING, input, depth)
            }
            out = union(out, option)
        }
    }
    return out.length ? out : NOTHING
}

function summarizeLeaf(input, mode, depth) {
    if (input.absent || input.unknown || Object.hasOwn(input, 'scalar')) return NOTHING
    const { node, ctx, seen } = input
    consume(node, ctx, depth)
    const sub = (node, modeOverride = mode) => summarize(ref(node, ctx, seen), modeOverride, depth + 1)
    const compose = (a, b) => product(a, b, input, depth)
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return literal(node, node.text, ctx)
    if (
        ts.isTemplateExpression(node) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    ) {
        const rendered = primitiveLeaf(input, depth + 1)
        let out = []
        // Complete folded values are actual class text, just like join output.
        // A surrounding concatenation/template must not turn an embedded comma
        // back into a class boundary.
        for (const value of rendered.values)
            if (typeof value === 'string') out = union(out, literal(node, value, ctx, true))
        if (rendered.complete) return out.length ? out : NOTHING
        // Opaque fragments retain the established conservative source policy.
        if (ts.isBinaryExpression(node)) return compose(sub(node.left), sub(node.right))
        out = literal(node.head, node.head.text, ctx)
        for (const span of node.templateSpans)
            out = compose(compose(out, sub(span.expression)), literal(span.literal, span.literal.text, ctx))
        return out
    }
    if (ts.isArrayLiteralExpression(node)) {
        let out = []
        for (const items of arrayItems(input, depth + 1)) {
            let option = mode === 'builder' ? NOTHING : []
            for (const item of items) {
                const alts = summarize(item, mode, depth + 1)
                option = mode === 'builder' ? compose(option, alts) : union(option, alts)
            }
            out = union(out, option)
        }
        return out.length ? out : NOTHING
    }
    if (ts.isObjectLiteralExpression(node)) {
        let out = []
        for (const fields of objectFields(input, depth + 1)) {
            const effective = new Map()
            for (const field of fields) effective.set(field.key === null ? field : field.key, field)
            let option = mode === 'builder' ? NOTHING : []
            for (const field of effective.values()) {
                if (mode !== 'builder') {
                    option = union(option, summarize(field.value, 'lookup', depth + 1))
                    continue
                }
                if (field.spread) {
                    option = compose(option, summarize(field.value, 'builder', depth + 1))
                    continue
                }
                if (truth(field.value, depth + 1) === false) continue
                const alts =
                    field.key !== null
                        ? literal(field.origin, field.key, ctx)
                        : field.keyExpression
                          ? summarize(field.keyExpression, 'builder', depth + 1).map((alt) => ({
                                token: alt.token === null ? null : field.origin.getStart(),
                                weight: alt.weight === null ? null : field.origin.getStart(),
                            }))
                          : NOTHING
                option = compose(option, alts)
            }
            out = union(out, option)
        }
        return out.length ? out : NOTHING
    }
    if (ts.isSpreadElement(node)) return sub(node.expression)
    if (ts.isCallExpression(node)) {
        const callee = node.expression
        const name = ts.isIdentifier(callee)
            ? callee.text
            : ts.isPropertyAccessExpression(callee)
              ? callee.name.text
              : null
        if (name === 'join' && ts.isPropertyAccessExpression(callee)) {
            const separator = node.arguments[0] ? primitive(ref(node.arguments[0], ctx, seen), depth + 1) : ','
            const whitespace = typeof separator === 'string' && separator.length > 0 && separator.trim() === ''
            return whitespace
                ? summarizeJoin(ref(callee.expression, ctx, seen), depth + 1)
                : sub(callee.expression, 'lookup')
        }
        if (BUILDERS.has(name)) {
            let out = NOTHING
            for (const arg of node.arguments) out = compose(out, sub(arg, 'builder'))
            return out
        }
    }
    return NOTHING
}
function alternatives(node, ctx) {
    return summarize(ref(node, { ...ctx, budget: { remaining: MAX_WORK } }), 'lookup')
}
module.exports = { alternatives, BUILDERS, OPAQUE, AnalysisError }
