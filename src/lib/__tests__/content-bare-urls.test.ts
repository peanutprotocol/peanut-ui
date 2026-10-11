// Gate for TASK-22253: a bare URL in content must end at an ASCII space.
// remark-gfm (src/lib/mdx.ts) ends an autolink literal only at ASCII
// whitespace, so a non-breaking space after `www.adr.org` became part of the
// link: the US card terms rendered http://www.adr.org%C2%A0or, which Mobile
// Safari rejects (Sentry PEANUT-UI-QMN). Fix the content in mono, not here:
// write the link as [www.example.org](https://www.example.org) or use a
// normal space.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const CONTENT_ROOT = join(__dirname, '..', '..', 'content', 'content')

// A bare URL runs until ASCII whitespace or `<`, the same place remark-gfm stops it
const BARE_URL_RE = /(?:https?:\/\/|www\.)[^\t\n\r <]+/g
// Unicode space separators other than U+0020: NBSP, narrow NBSP, thin space, …
const NON_ASCII_SPACE_RE = /(?! )\p{Zs}/u

function listMarkdownFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return listMarkdownFiles(path)
        return /\.mdx?$/.test(entry.name) ? [path] : []
    })
}

function findBareUrlsWithNonAsciiSpace(source: string): string[] {
    return (source.match(BARE_URL_RE) ?? []).filter((url) => NON_ASCII_SPACE_RE.test(url))
}

describe('findBareUrlsWithNonAsciiSpace', () => {
    it('flags a non-breaking space after a bare URL', () => {
        expect(findBareUrlsWithNonAsciiSpace('available at www.adr.org or by')).toEqual(['www.adr.org or'])
    })

    it('flags a narrow no-break space after an https URL', () => {
        expect(findBareUrlsWithNonAsciiSpace('see https://peanut.me now')).toHaveLength(1)
    })

    it('accepts an explicit Markdown link and normal spaces', () => {
        expect(findBareUrlsWithNonAsciiSpace('available at [www.adr.org](https://www.adr.org) or by')).toEqual([])
        expect(findBareUrlsWithNonAsciiSpace('available at www.adr.org or by')).toEqual([])
    })
})

describe('content markdown', () => {
    const files = listMarkdownFiles(CONTENT_ROOT)

    // an empty src/content submodule would otherwise pass this gate silently
    it('finds the content files', () => {
        expect(files.length).toBeGreaterThan(0)
    })

    it('has no bare URL followed by a non-ASCII space', () => {
        const offenders = files.flatMap((file) =>
            findBareUrlsWithNonAsciiSpace(readFileSync(file, 'utf8')).map(
                (url) => `${relative(CONTENT_ROOT, file)}: ${JSON.stringify(url)}`
            )
        )
        expect(offenders).toEqual([])
    })
})
