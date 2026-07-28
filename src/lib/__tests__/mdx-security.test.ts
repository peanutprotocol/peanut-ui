import { remarkNoExecutableContent } from '@/lib/mdx-security'

/**
 * Node type names and estree shapes below mirror what @mdx-js/mdx's parser
 * actually emits — they were read off the real parser, not guessed.
 */
const plugin = remarkNoExecutableContent()

const root = (...children: unknown[]) => ({ type: 'root', children }) as never

/** An expression node carrying a parsed program, the way the real parser emits it. */
const expression = (type: string, value: string, body: unknown[], line?: number) => ({
    type,
    value,
    data: { estree: { body } },
    ...(line ? { position: { start: { line } } } : {}),
})

const statement = (expr: unknown) => ({ type: 'ExpressionStatement', expression: expr })
const literal = (value: unknown) => ({ type: 'Literal', value })

describe('remarkNoExecutableContent', () => {
    describe('rejects executable MDX', () => {
        it('rejects a call expression', () => {
            const tree = root(
                expression('mdxFlowExpression', 'require("fs")', [statement({ type: 'CallExpression' })], 3)
            )
            expect(() => plugin(tree)).toThrow(/JavaScript expression.*line 3/s)
        })

        it('rejects a member expression prop', () => {
            const tree = root({
                type: 'mdxJsxFlowElement',
                attributes: [
                    {
                        type: 'mdxJsxAttribute',
                        name: 'bar',
                        value: expression('mdxJsxAttributeValueExpression', 'process.env', [
                            statement({ type: 'MemberExpression' }),
                        ]),
                    },
                ],
            })
            expect(() => plugin(tree)).toThrow(/expression prop/)
        })

        it('rejects import/export outright', () => {
            const tree = root({ type: 'mdxjsEsm', value: "import fs from 'fs'" })
            expect(() => plugin(tree)).toThrow(/import\/export statement/)
        })

        it('rejects a JSX spread attribute outright', () => {
            const tree = root({
                type: 'mdxJsxFlowElement',
                attributes: [{ type: 'mdxJsxExpressionAttribute', value: '...process.env' }],
            })
            expect(() => plugin(tree)).toThrow(/spread attribute/)
        })

        it('rejects a multi-statement program', () => {
            const tree = root(
                expression('mdxTextExpression', 'a;b', [statement(literal(1)), statement({ type: 'CallExpression' })])
            )
            expect(() => plugin(tree)).toThrow(/JavaScript expression/)
        })

        it('fails closed when the expression has no parsed program', () => {
            const tree = root({ type: 'mdxTextExpression', value: 'whatever' })
            expect(() => plugin(tree)).toThrow(/JavaScript expression/)
        })

        it('finds executable nodes nested deep in the tree', () => {
            const tree = root({
                type: 'blockquote',
                children: [
                    {
                        type: 'paragraph',
                        children: [expression('mdxTextExpression', 'evil()', [statement({ type: 'CallExpression' })])],
                    },
                ],
            })
            expect(() => plugin(tree)).toThrow(/JavaScript expression/)
        })
    })

    describe('allows the inert forms content actually uses', () => {
        it('allows a comment-only expression — {/* … */} parses to an empty program', () => {
            const tree = root(expression('mdxFlowExpression', '/* a note to editors */', []))
            expect(() => plugin(tree)).not.toThrow()
        })

        it('allows a literal prop — <Step number={1} />', () => {
            const tree = root({
                type: 'mdxJsxFlowElement',
                attributes: [
                    {
                        type: 'mdxJsxAttribute',
                        name: 'number',
                        value: expression('mdxJsxAttributeValueExpression', '1', [statement(literal(1))]),
                    },
                ],
            })
            expect(() => plugin(tree)).not.toThrow()
        })

        it('allows a signed literal — {-1}', () => {
            const tree = root(
                expression('mdxTextExpression', '-1', [
                    statement({ type: 'UnaryExpression', operator: '-', argument: literal(1) }),
                ])
            )
            expect(() => plugin(tree)).not.toThrow()
        })

        it('allows plain markdown', () => {
            const tree = root({ type: 'heading', depth: 1, children: [{ type: 'text', value: 'Fees' }] })
            expect(() => plugin(tree)).not.toThrow()
        })

        it('allows a JSX component with string props', () => {
            const tree = root({
                type: 'mdxJsxFlowElement',
                attributes: [{ type: 'mdxJsxAttribute', name: 'currency', value: 'ARS' }],
                children: [{ type: 'text', value: 'hi' }],
            })
            expect(() => plugin(tree)).not.toThrow()
        })

        it('tolerates an empty tree', () => {
            expect(() => plugin(root())).not.toThrow()
        })
    })
})
