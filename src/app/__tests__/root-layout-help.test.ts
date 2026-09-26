/**
 * Help articles once rode in the root layout: every render compiled 28 MDX
 * documents and serialized them into every page's HTML (TASK-23054). The
 * articles are now static files the drawer fetches on open. These checks keep
 * them, and the drawer code, out of every page's initial payload.
 */
import fs from 'fs'
import path from 'path'

const source = (file: string) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf-8')

// Static imports only; `import type` and dynamic `import()` do not ship with the importer.
const staticImports = (code: string) =>
    [...code.matchAll(/^import\s+(?!type\s)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1])

describe('help articles stay out of every page', () => {
    it('keeps the article loader out of the root layout', () => {
        const layout = source('app/layout.tsx')
        expect(layout).not.toMatch(/appHelp/i)
        expect(layout).toMatch(/export default function RootLayout/)
    })

    it('keeps the drawer out of the eager client graph', () => {
        for (const file of [
            'app/ClientProviders.tsx',
            'components/Global/AppHelpProvider.tsx',
            'components/Global/DocsLink.tsx',
            'components/Global/AppHelpSupportCTA.tsx',
        ]) {
            const imports = staticImports(source(file))
            expect(
                imports.filter((specifier) =>
                    /AppHelp(Drawer|Mdx)$|appHelpArticle\.server$|appHelpPreload$|useAboutHelpPreload$/.test(specifier)
                )
            ).toEqual([])
        }
    })
})
