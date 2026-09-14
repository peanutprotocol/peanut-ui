// File traversal and lexical scopes for the weight-stack metric.
// Expression semantics and limits live in ds-lint-expressions.cjs.
// The supported subset and counting policy are in ds-lint-contract.md.
const ts = require('typescript')
const { alternatives, BUILDERS, OPAQUE, AnalysisError } = require('./ds-lint-expressions.cjs')
const isClassNameProp = (name) => /[a-zA-Z]*[cC]lassName$/.test(name)
function calleeName(node) {
    const callee = node.expression
    if (ts.isIdentifier(callee)) return callee.text
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text
    return null
}
const isMatch = (alt) => alt.token !== null && alt.weight !== null
const altKey = (alt) => `${alt.token ?? '-'}:${alt.weight ?? '-'}`

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

    const ctx = { scopes: [], isToken, isWeight, source }
    const sites = new Set()
    const record = (alts) => {
        for (const alt of alts) if (isMatch(alt)) sites.add(altKey(alt))
    }

    const visit = (node) => {
        if (
            (ts.isCallExpression(node) && calleeName(node) === 'cva') ||
            (ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'class-variance-authority')
        ) {
            throw new AnalysisError(
                'UNSUPPORTED_CVA',
                node,
                ctx,
                'CVA is outside the supported class-expression subset; see scripts/ds-lint-contract.md'
            )
        }
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
        if (isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node)) {
            if (isFunctionLike(node)) scopes.push(parameterBindings(node))
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

module.exports = { weightStackSites, BUILDERS, OPAQUE, AnalysisError }
