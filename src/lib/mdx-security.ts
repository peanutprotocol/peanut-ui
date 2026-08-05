/**
 * Make it a build error for content to contain executable JavaScript.
 *
 * Raw MDX compiles expressions straight through to executable JS —
 * `{require('fs').readFileSync('/etc/passwd')}` survives verbatim — which would
 * run during `next build`, in CI and on Vercel, both of which carry secrets.
 *
 * We are not exposed to that today, and this module is NOT the thing preventing
 * it: `next-mdx-remote@6` already strips the same node set by default, via
 * `removeJavaScriptExpressions` (`blockJS`) and `removeImportsExportsPlugin`
 * (`useDynamicImport: false`). This exists for two reasons anyway:
 *
 * 1. That protection is a dependency's *default*, on a path that now publishes
 *    to production with no human review. A major upgrade, or someone passing
 *    `blockJS: false` or `useDynamicImport: true` for an unrelated reason,
 *    re-opens it silently. This asserts the invariant in our own repo, where it
 *    is visible and tested.
 * 2. next-mdx-remote *silently strips*; we run first in `remarkPlugins`, so we
 *    *throw*. An author who writes `{price}` expecting interpolation currently
 *    gets a page that quietly renders nothing and auto-publishes. They should
 *    get a failed build naming the file and line.
 *
 * So: the value here is failing loud and pinning the invariant, not closing a
 * live hole. Do not delete it on the grounds that "the library handles it" —
 * that is precisely the assumption it exists to keep honest.
 *
 * It is deliberately not a blanket ban on `{...}` — content legitimately uses
 * two inert forms, and breaking them would just push authors around the guard:
 *
 *   {/* a comment *\/}          → compiles to nothing at all
 *   <Step number={1} />         → a literal; there is no code to run
 *
 * So the rule is *executable*, not *braced*: an expression is allowed only when
 * its parsed program is empty (comment-only) or a single literal. Anything that
 * can call, read, or reference — `{process.env}`, `{fn()}`, `{...spread}`,
 * `import` — is rejected at compile time.
 *
 * Fail-closed: if an expression arrives without a parsed program we cannot prove
 * it is inert, so it is rejected.
 */

/** Executable unless proven inert. Node type names verified against @mdx-js/mdx's parser. */
const GUARDED_EXPRESSIONS: Record<string, string> = {
    mdxFlowExpression: 'a JavaScript expression',
    mdxTextExpression: 'a JavaScript expression',
    mdxJsxAttributeValueExpression: 'a JSX expression prop (prop={x})',
}

/** Never legitimate in content — no inert form exists. */
const FORBIDDEN_NODES: Record<string, string> = {
    mdxjsEsm: 'an import/export statement',
    mdxJsxExpressionAttribute: 'a JSX spread attribute ({...x})',
}

type EstreeNode = { type?: string; operator?: string; argument?: EstreeNode; expression?: EstreeNode }

type MdxNode = {
    type?: string
    children?: MdxNode[]
    attributes?: MdxNode[]
    value?: unknown
    data?: { estree?: { body?: EstreeNode[] } }
    position?: { start?: { line?: number } }
}

/** A literal — or a signed literal like `{-1}`, which is still nothing to execute. */
function isLiteral(expression?: EstreeNode): boolean {
    if (expression?.type === 'Literal') return true
    if (expression?.type === 'UnaryExpression' && (expression.operator === '-' || expression.operator === '+')) {
        return expression.argument?.type === 'Literal'
    }
    return false
}

function isInert(node: MdxNode): boolean {
    const body = node.data?.estree?.body
    if (!Array.isArray(body)) return false // unparsed — cannot prove it is safe
    if (body.length === 0) return true // comment-only
    if (body.length > 1) return false
    const [statement] = body
    return statement?.type === 'ExpressionStatement' && isLiteral(statement.expression)
}

function reject(node: MdxNode, what: string): never {
    const at = node.position?.start?.line ? ` at line ${node.position.start.line}` : ''
    throw new Error(
        `Executable MDX rejected: content contains ${what}${at}. ` +
            `Content is published to production without human review, so it must not be able to run code. ` +
            `Use markdown, a literal prop, or a registered component.`
    )
}

function walk(node: MdxNode): void {
    if (!node || typeof node !== 'object') return

    const type = node.type as string
    if (type in FORBIDDEN_NODES) reject(node, FORBIDDEN_NODES[type])
    if (type in GUARDED_EXPRESSIONS && !isInert(node)) reject(node, GUARDED_EXPRESSIONS[type])

    for (const child of node.children ?? []) walk(child)

    // JSX attributes are not `children`, so they need their own pass: both the
    // attribute node itself (a spread) and its value (an expression prop) can
    // carry code.
    for (const attribute of node.attributes ?? []) {
        walk(attribute)
        const value = attribute?.value
        if (value && typeof value === 'object') walk(value as MdxNode)
    }
}

/**
 * Remark plugin that fails the compile if content contains executable MDX.
 * It throws, which aborts the build rather than silently rendering.
 */
export function remarkNoExecutableContent() {
    return (tree: MdxNode): void => walk(tree)
}
