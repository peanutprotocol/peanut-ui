import { isValidElement, type ReactNode } from 'react'

/**
 * Flatten a rendered node to its plain text — MDX prose carries inline markup,
 * so `children` is an array as soon as a heading or an answer holds a bold word
 * or a link. Used for JSON-LD bodies and for the ProseStars seed.
 */
export function extractText(node: ReactNode): string {
    if (typeof node === 'string') return node
    if (typeof node === 'number') return String(node)
    if (!node) return ''
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (isValidElement(node)) return extractText((node.props as { children?: ReactNode }).children)
    return ''
}
