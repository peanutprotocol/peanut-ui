import { Fragment, isValidElement, type ReactNode } from 'react'
import type { AppHelpNode, AppHelpNodeProps } from './appHelpTypes'

type SerializeOptions = {
    /** Stand-in component → the MDX tag name it replaced. */
    componentNames: ReadonlyMap<unknown, string>
    /** Rewrites an internal href (one that starts with `/`) for the reader's locale. */
    resolveHref: (href: string) => string
}

function literalProps(props: Record<string, unknown>): AppHelpNodeProps | undefined {
    const entries = Object.entries(props).filter(
        (entry): entry is [string, string | number | boolean] =>
            entry[0] !== 'children' && ['string', 'number', 'boolean'].includes(typeof entry[1])
    )
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/**
 * Turn the element tree an MDX document evaluates to into plain JSON.
 *
 * The document is evaluated with stand-in components, so every element is an
 * HTML tag, a stand-in (recorded by name), a fragment, or the MDX wrapper
 * function, which is called once to reach its tree. Nothing is rendered.
 */
export function serializeMdxTree(node: ReactNode, options: SerializeOptions): AppHelpNode[] {
    if (node === null || node === undefined || typeof node === 'boolean') return []
    if (typeof node === 'string' || typeof node === 'number') return [String(node)]
    if (Array.isArray(node)) return node.flatMap((child) => serializeMdxTree(child, options))
    if (!isValidElement(node)) return []

    const props = node.props as Record<string, unknown> & { children?: ReactNode }
    if (node.type === Fragment) return serializeMdxTree(props.children, options)

    const name = typeof node.type === 'string' ? node.type : options.componentNames.get(node.type)
    if (!name) {
        if (typeof node.type === 'function') {
            return serializeMdxTree((node.type as (props: unknown) => ReactNode)(props), options)
        }
        return []
    }

    const p = literalProps(props)
    if (name === 'a' && typeof p?.href === 'string' && p.href.startsWith('/')) p.href = options.resolveHref(p.href)
    const c = serializeMdxTree(props.children, options)
    return [{ t: name, ...(p && { p }), ...(c.length > 0 && { c }) }]
}
