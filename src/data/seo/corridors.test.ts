import fs from 'fs'
import path from 'path'
import { CORRIDORS, RECEIVE_SOURCES } from './corridors'

const RECEIVE_FROM_DIR = path.join(process.cwd(), 'src/content/content/receive-from')

// Regression guard for the May 2026 live 404s: receive-money-from rendered for
// every corridor origin, but origins lacking a receive-from article (colombia,
// mexico) 404ed. RECEIVE_SOURCES must be CORRIDORS.from gated by content.
describe('RECEIVE_SOURCES', () => {
    it('only contains corridor origins', () => {
        const origins = new Set(CORRIDORS.map((c) => c.from))
        for (const slug of RECEIVE_SOURCES) {
            expect(origins.has(slug)).toBe(true)
        }
    })

    it('only contains origins that have a receive-from article (no 404s)', () => {
        for (const slug of RECEIVE_SOURCES) {
            const enFile = path.join(RECEIVE_FROM_DIR, slug, 'en.md')
            expect(fs.existsSync(enFile)).toBe(true)
        }
    })

    it('drops corridor origins with no receive-from article', () => {
        const origins = [...new Set(CORRIDORS.map((c) => c.from))]
        for (const slug of origins) {
            const hasArticle = fs.existsSync(path.join(RECEIVE_FROM_DIR, slug, 'en.md'))
            expect(RECEIVE_SOURCES.includes(slug)).toBe(hasArticle)
        }
    })
})
