import { createElement } from 'react'
import { serializeMdxTree } from '../serializeMdxTree'

const Steps = (_props: { title: string; number: number; children: React.ReactNode }) => null
const componentNames = new Map<unknown, string>([[Steps, 'Steps']])
const resolveHref = (href: string) => `/es-419${href}`

// Shaped like an evaluated MDX document: a wrapper function returning a fragment.
function MDXContent() {
    return (
        <>
            <h2>Title</h2>
            {'\n'}
            <Steps title="Do it" number={1}>
                <p style={{ color: 'red' }} onClick={() => undefined}>
                    See {createElement('a', { href: '/help/refunds' }, 'refunds')} or{' '}
                    <a href="https://example.com">this</a>.
                </p>
            </Steps>
        </>
    )
}

describe('serializeMdxTree', () => {
    it('keeps tags, component names, literal props and text, and resolves internal links', () => {
        expect(serializeMdxTree(<MDXContent />, { componentNames, resolveHref })).toEqual([
            { t: 'h2', c: ['Title'] },
            '\n',
            {
                t: 'Steps',
                p: { title: 'Do it', number: 1 },
                c: [
                    {
                        t: 'p',
                        c: [
                            'See ',
                            { t: 'a', p: { href: '/es-419/help/refunds' }, c: ['refunds'] },
                            ' or ',
                            { t: 'a', p: { href: 'https://example.com' }, c: ['this'] },
                            '.',
                        ],
                    },
                ],
            },
        ])
    })

    it('produces JSON that survives a round trip', () => {
        const tree = serializeMdxTree(<MDXContent />, { componentNames, resolveHref })
        expect(JSON.parse(JSON.stringify(tree))).toEqual(tree)
    })
})
