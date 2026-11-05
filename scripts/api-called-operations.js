const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'])
const DEFAULT_GET_CALLS = new Set(['apiFetch', 'serverFetch', 'fetchWithSentry', 'fetch', 'read'])

function calledApiOperations(sourceDir, localSpec) {
    const operations = new Map()
    const paths = Object.entries(localSpec.paths)
    const pathSegments = new Map(paths.map(([route]) => [route, route.split('/')]))
    const patternSegments = new Map()
    const sources = []
    const apiCalls = new Map([...DEFAULT_GET_CALLS].map((name) => [name, [{ index: 0 }]]))
    const functions = []
    const bindings = new Map()
    const globals = new Map()
    const returns = new Map()
    const isScope = (node) => ts.isSourceFile(node) || ts.isBlock(node) || ts.isFunctionLike(node)
    const callName = (node) => node.expression.getText().split('.').pop()
    function collect(file) {
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
        sources.push(source)
        function visit(node) {
            if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && ts.isIdentifier(node.name)) {
                let scope = node.parent
                while (scope && !isScope(scope)) scope = scope.parent
                if (!bindings.has(scope)) bindings.set(scope, new Map())
                bindings.get(scope).set(node.name.text, node.initializer)
                if (scope === source && node.initializer) {
                    if (!globals.has(node.name.text)) globals.set(node.name.text, [])
                    globals.get(node.name.text).push(node.initializer)
                }
            }
            if (ts.isFunctionLike(node) && node.body) {
                const name =
                    node.name?.getText() ?? (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText() : null)
                if (name) {
                    const calls = []
                    function findCalls(child) {
                        if (ts.isCallExpression(child)) calls.push(child)
                        ts.forEachChild(child, findCalls)
                    }
                    findCalls(node.body)
                    functions.push({ name, calls, parameters: node.parameters.map((param) => param.name.getText()) })
                    const expressions = []
                    function findReturns(child) {
                        if (ts.isFunctionLike(child)) return
                        if (ts.isReturnStatement(child) && child.expression) expressions.push(child.expression)
                        ts.forEachChild(child, findReturns)
                    }
                    if (ts.isBlock(node.body)) findReturns(node.body)
                    else expressions.push(node.body)
                    if (!returns.has(name)) returns.set(name, [])
                    returns.get(name).push(expressions)
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(source)
    }
    function scan(source) {
        function values(node, depth = 0) {
            if (!node || depth > 8) return ['{*}']
            if (ts.isStringLiteralLike(node)) return [node.text]
            if (ts.isTemplateExpression(node)) {
                let result = [node.head.text]
                for (const span of node.templateSpans) {
                    const suffixes = values(span.expression, depth + 1)
                    result = result.flatMap((prefix) => suffixes.map((suffix) => prefix + suffix + span.literal.text))
                }
                return result
            }
            if (ts.isConditionalExpression(node))
                return [...values(node.whenTrue, depth + 1), ...values(node.whenFalse, depth + 1)]
            if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
                return values(node.left, depth + 1).flatMap((a) => values(node.right, depth + 1).map((b) => a + b))
            }
            if (ts.isIdentifier(node)) {
                let scope = node.parent
                while (scope) {
                    if (bindings.get(scope)?.has(node.text))
                        return values(bindings.get(scope).get(node.text), depth + 1)
                    scope = scope.parent
                }
                if (globals.get(node.text)?.length === 1) return values(globals.get(node.text)[0], depth + 1)
            }
            if (ts.isCallExpression(node) && returns.get(callName(node))?.length === 1)
                return returns.get(callName(node))[0].flatMap((expression) => values(expression, depth + 1))
            if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node))
                return values(node.expression, depth + 1)
            return ['{*}']
        }
        function methods(call) {
            const options = call.arguments.find(ts.isObjectLiteralExpression)
            if (!options) {
                const positional = call.arguments
                    .flatMap((arg) => values(arg))
                    .map((value) => value.toLowerCase())
                    .filter((value) => METHODS.has(value))
                if (positional.length) return positional
                return DEFAULT_GET_CALLS.has(callName(call)) && call.arguments.length === 1 ? ['get'] : null
            }
            const method = options.properties.find(
                (property) => property.name?.getText(source).replace(/['"]/g, '') === 'method'
            )
            if (options.properties.some(ts.isSpreadAssignment)) return null
            if (method && ts.isPropertyAssignment(method)) {
                const result = values(method.initializer).map((value) => value.toLowerCase())
                return result.every((value) => METHODS.has(value)) ? result : null
            }
            return options.properties.some(ts.isSpreadAssignment) || method || !DEFAULT_GET_CALLS.has(callName(call))
                ? null
                : ['get']
        }
        function matches(pattern, candidate) {
            if (!patternSegments.has(pattern)) {
                let route = pattern
                    .replace(/^https?:\/\/[^/]+/, '')
                    .replace(/^\{\*\}(?=\/)/, '')
                    .split(/[?#]/)[0]
                if (route.endsWith('{*}') && !route.endsWith('/{*}')) route = route.slice(0, -3)
                patternSegments.set(pattern, route.startsWith('/') ? route.split('/') : null)
            }
            const a = patternSegments.get(pattern)
            const b = pathSegments.get(candidate)
            if (!a) return false
            return (
                a.length === b.length &&
                a.every((segment, index) => {
                    if (/^\{[^}]+\}$/.test(b[index])) return segment.length > 0
                    if (!segment.includes('{*}')) return segment === b[index]
                    const regex = segment
                        .split('{*}')
                        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                        .join('.*')
                    return new RegExp(`^${regex}$`).test(b[index])
                })
            )
        }
        function argumentPatterns(node, property) {
            if (property && node && ts.isObjectLiteralExpression(node)) {
                const field = node.properties.find((field) => field.name?.getText() === property)
                return field && ts.isPropertyAssignment(field) ? values(field.initializer) : []
            }
            return property ? [] : values(node)
        }
        function visit(node) {
            if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
            if (ts.isCallExpression(node) && apiCalls.has(callName(node))) {
                const patterns = apiCalls
                    .get(callName(node))
                    .flatMap(({ index, property }) => argumentPatterns(node.arguments[index], property))
                const calledMethods = methods(node)
                for (const [route, specMethods] of paths) {
                    if (!patterns.some((pattern) => matches(pattern, route))) continue
                    for (const method of calledMethods ??
                        Object.keys(specMethods).filter((name) => METHODS.has(name))) {
                        if (specMethods[method]) operations.set(`${method} ${route}`, { path: route, method })
                    }
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(source)
    }
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (/^(?:__tests__|__fixtures__|fixtures|dev|types|node_modules)$/.test(entry.name)) continue
            const file = path.join(dir, entry.name)
            if (entry.isDirectory()) walk(file)
            else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec|d)\.tsx?$/.test(entry.name)) collect(file)
        }
    }
    walk(sourceDir)
    let changed = true
    while (changed) {
        changed = false
        for (const { name, calls, parameters } of functions) {
            if (apiCalls.has(name)) continue
            const forwarded = []
            for (const call of calls) {
                for (const target of apiCalls.get(callName(call)) ?? []) {
                    const arg = call.arguments[target.index]
                    if (!arg) continue
                    const identifier = ts.isPropertyAccessExpression(arg) ? arg.expression : arg
                    if (!ts.isIdentifier(identifier)) continue
                    const index = parameters.indexOf(identifier.text)
                    if (index < 0) continue
                    forwarded.push({
                        index,
                        property: ts.isPropertyAccessExpression(arg) ? arg.name.text : target.property,
                    })
                }
            }
            if (forwarded.length) {
                apiCalls.set(name, forwarded)
                changed = true
            }
        }
    }
    sources.forEach(scan)
    return [...operations.values()].sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`))
}

module.exports = { calledApiOperations }
