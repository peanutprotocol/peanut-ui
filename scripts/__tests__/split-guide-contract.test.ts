import {
    findSplitGuideHeadingCollisions,
    remarkRejectSplitGuideH1,
    stripSplitGuideFencedCode,
} from '../lib/split-guide-contract'

const h1 = (line: number) => ({
    type: 'heading',
    depth: 1,
    position: { start: { line } },
    children: [{ type: 'text', value: 'Forbidden heading' }],
})

const root = (...children: unknown[]) => ({ type: 'root', children }) as never

describe('Split guide route-owned H1 guard', () => {
    it.each([
        ['# ATX heading', 'atx-h1'],
        ['   # indented ATX heading', 'atx-h1'],
        ['Title\n=====', 'setext-h1'],
        ['Title\n  =====  ', 'setext-h1'],
        ['<h1>HTML heading</h1>', 'html-h1'],
        ['<h1 class="title">HTML heading</h1>', 'html-h1'],
        ['<Hero title="Guide" />', 'hero'],
    ])('detects %s', (body, expected) => {
        expect(findSplitGuideHeadingCollisions(body)).toContain(expected)
    })

    it('allows ordinary content and lower-level headings', () => {
        expect(findSplitGuideHeadingCollisions('## Section\n\n### Detail\n\nPlain copy.')).toEqual([])
    })

    it('allows heading and component syntax when it is shown inside fenced code', () => {
        expect(
            findSplitGuideHeadingCollisions(`\`\`\`mdx
# Example H1
Example setext H1
=================
<h1>Example HTML</h1>
<Hero title="Example component" />
\`\`\``)
        ).toEqual([])
    })

    it('preserves offsets while hiding fenced code, including CRLF input', () => {
        const body = 'Before\r\n```mdx\r\n<Hero title="Example" />\r\n```\r\n<CTA />'
        const stripped = stripSplitGuideFencedCode(body)

        expect(stripped).toHaveLength(body.length)
        expect(stripped.indexOf('<CTA />')).toBe(body.indexOf('<CTA />'))
        expect(stripped).not.toContain('<Hero')
    })

    describe('authoritative remark AST traversal', () => {
        const rejectH1 = remarkRejectSplitGuideH1()

        it.each([
            ['> # Quoted H1', root({ type: 'blockquote', children: [h1(1)] })],
            ['- # List H1', root({ type: 'list', children: [{ type: 'listItem', children: [h1(1)] }] })],
            ['> Quoted setext H1\n> =================', root({ type: 'blockquote', children: [h1(1)] })],
        ])('rejects parsed %s', (_source, tree) => {
            expect(() => rejectH1(tree)).toThrow(/route owns the sole H1/)
        })

        it('recursively allows lower-level headings', () => {
            const tree = root({
                type: 'blockquote',
                children: [
                    {
                        type: 'list',
                        children: [{ type: 'listItem', children: [{ type: 'heading', depth: 2 }] }],
                    },
                ],
            })
            expect(() => rejectH1(tree)).not.toThrow()
        })
    })
})
