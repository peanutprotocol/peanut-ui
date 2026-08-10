export type SplitGuideHeadingCollision = 'atx-h1' | 'setext-h1' | 'html-h1' | 'hero'

interface MdastNode {
    type?: string
    depth?: number
    children?: MdastNode[]
    position?: { start?: { line?: number } }
}

/**
 * Authoritative H1 guard for the same remark tree that is compiled into the
 * page. Walking every child catches headings nested in blockquotes and list
 * items, and the parser normalizes both ATX and setext H1 syntax to the same
 * `heading` node with `depth: 1`.
 */
export function remarkRejectSplitGuideH1() {
    return (tree: MdastNode) => {
        const visit = (node: MdastNode) => {
            if (node.type === 'heading' && node.depth === 1) {
                const location = node.position?.start?.line ? ` on line ${node.position.start.line}` : ''
                throw new Error(`Split guide body must not contain an H1${location}; the route owns the sole H1`)
            }
            for (const child of node.children ?? []) visit(child)
        }
        visit(tree)
    }
}

/**
 * Cheap source-level diagnostics for fast, specific error messages. The remark
 * plugin above remains authoritative because regex cannot understand nesting.
 */
export function findSplitGuideHeadingCollisions(body: string): SplitGuideHeadingCollision[] {
    const collisions: SplitGuideHeadingCollision[] = []
    if (/^[ \t]*#(?:[ \t]+|$)/m.test(body)) collisions.push('atx-h1')
    if (/^(?![ \t]*$).+\r?\n[ \t]*=+[ \t]*$/m.test(body)) collisions.push('setext-h1')
    if (/<h1(?:\s|>)/i.test(body)) collisions.push('html-h1')
    if (/<Hero\b/.test(body)) collisions.push('hero')
    return collisions
}
