import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { RECEIVE_SOURCES } from './corridors'

const RECEIVE_FROM_DIR = path.join(process.cwd(), 'src/content/content/receive-from')

beforeAll(() => {
    if (!fs.existsSync(RECEIVE_FROM_DIR)) {
        throw new Error(
            `content tree missing at ${RECEIVE_FROM_DIR} — the src/content submodule is not ` +
                'initialized in this checkout. Run: git submodule update --init'
        )
    }
})

/** Re-derive the expected set straight off the filesystem, independently of
 *  the content lib the loader uses — a guard that reuses the loader's own
 *  helper would only prove it equals itself. gray-matter is used directly (not
 *  via the lib) so YAML semantics match what the loader's parser actually does
 *  (`published: False`, trailing comments, nesting). */
function publishedReceiveFromSlugs(): string[] {
    return fs
        .readdirSync(RECEIVE_FROM_DIR)
        .filter((slug) => slug !== 'index')
        .filter((slug) => fs.statSync(path.join(RECEIVE_FROM_DIR, slug)).isDirectory())
        .filter((slug) => fs.existsSync(path.join(RECEIVE_FROM_DIR, slug, 'en.md')))
        .filter((slug) => {
            const raw = fs.readFileSync(path.join(RECEIVE_FROM_DIR, slug, 'en.md'), 'utf8')
            return matter(raw).data.published !== false
        })
}

// Regression guard for the May 2026 live 404s: receive-money-from must only
// render slugs that have a published article. The guard used to also require
// RECEIVE_SOURCES ⊆ CORRIDORS.from, which was never what protected us — it was
// an artifact of how the list was built, and it silently dropped 10 authored
// countries whose articles were live but unreachable. What the route actually
// needs is the both-directions equality below: nothing rendered without
// content (no 404s), and nothing authored left behind (no orphans).
describe('RECEIVE_SOURCES', () => {
    it('only contains slugs that have a published receive-from article (no 404s)', () => {
        for (const slug of RECEIVE_SOURCES) {
            const enFile = path.join(RECEIVE_FROM_DIR, slug, 'en.md')
            expect(fs.existsSync(enFile)).toBe(true)
        }
    })

    it('contains every published receive-from article (no orphaned content)', () => {
        expect([...RECEIVE_SOURCES].sort()).toEqual(publishedReceiveFromSlugs().sort())
    })

    it('has no duplicate slugs', () => {
        expect(RECEIVE_SOURCES.length).toBe(new Set(RECEIVE_SOURCES).size)
    })
})
