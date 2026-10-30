/** Documented OpenAPI response examples, for capture requests no fixture or demo handler answers. */
type Node = Record<string, unknown>
export type OpenApiExample = { status: number; data: unknown }

const isNode = (value: unknown): value is Node => !!value && typeof value === 'object' && !Array.isArray(value)
const isParam = (segment: string) => /^\{[^/{}]+\}$/.test(segment)
const segments = (path: string) =>
    path
        .split(/[?#]/)[0]
        .split('/')
        .filter(Boolean)
        .map((segment) => {
            try {
                return decodeURIComponent(segment)
            } catch {
                return segment
            }
        })
// A fetch Response cannot carry a body with these statuses.
const NO_BODY = new Set(['204', '205'])

function deref(spec: Node, value: unknown): unknown {
    for (let hops = 0; isNode(value) && typeof value.$ref === 'string'; hops++) {
        if (hops === 8 || !value.$ref.startsWith('#/')) return undefined
        value = value.$ref
            .slice(2)
            .split('/')
            .map((key) => key.replace(/~1/g, '/').replace(/~0/g, '~'))
            .reduce<unknown>((node, key) => (isNode(node) ? node[key] : undefined), spec)
    }
    return value
}

/** The method's operation on the matching template with the most literal segments. */
function operationFor(spec: Node, method: string, path: string): Node | undefined {
    if (!isNode(spec.paths)) return undefined
    const request = segments(path)
    let best: { rank: string; operation: Node } | undefined
    for (const [template, item] of Object.entries(spec.paths)) {
        const operation = isNode(item) ? item[method.toLowerCase()] : undefined
        const parts = template.split('/').filter(Boolean)
        if (
            !isNode(operation) ||
            parts.length !== request.length ||
            parts.some((part, index) => !isParam(part) && part !== request[index])
        )
            continue
        const literals = parts.map((part) => (isParam(part) ? '0' : '1')).join('')
        // Most literals first; on a tie, the earlier literal wins.
        const rank = `${String(literals.replace(/0/g, '').length).padStart(3, '0')}${literals}`
        if (!best || rank > best.rank) best = { rank, operation }
    }
    return best?.operation
}

/** The lowest 2xx JSON response that documents an `example` or a first `examples` value. */
export function exampleFor(spec: unknown, method: string, path: string): OpenApiExample | undefined {
    if (!isNode(spec)) return undefined
    const responses = operationFor(spec, method, path)?.responses
    if (!isNode(responses)) return undefined
    const codes = Object.keys(responses)
        .filter((code) => /^2\d\d$/.test(code) && !NO_BODY.has(code))
        .sort()
    for (const code of codes) {
        const response = deref(spec, responses[code])
        const media = isNode(response) && isNode(response.content) ? response.content['application/json'] : undefined
        if (!isNode(media)) continue
        if (media.example !== undefined) return { status: Number(code), data: media.example }
        const value = Object.values(isNode(media.examples) ? media.examples : {})
            .map((example) => deref(spec, example))
            .find((example) => isNode(example) && example.value !== undefined)
        if (isNode(value)) return { status: Number(code), data: value.value }
    }
    return undefined
}
