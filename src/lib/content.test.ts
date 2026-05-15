import { listAllContent } from '@/lib/content'

describe('listAllContent', () => {
    it('returns items across all 4 hub types for en', () => {
        const items = listAllContent('en')
        const types = new Set(items.map((i) => i.type))
        expect(types).toEqual(new Set(['blog', 'stories', 'use-cases', 'compare']))
        expect(items.length).toBeGreaterThanOrEqual(15)
    })

    it('builds correct href per type', () => {
        const items = listAllContent('en')
        const blog = items.find((i) => i.type === 'blog')!
        const compare = items.find((i) => i.type === 'compare')!
        const stories = items.find((i) => i.type === 'stories')!
        expect(blog.href).toBe(`/en/blog/${blog.slug}`)
        expect(compare.href).toBe(`/en/compare/peanut-vs-${compare.slug}`)
        expect(stories.href).toBe(`/en/stories/${stories.slug}`)
    })

    it('records the resolved locale on each item (lang field)', () => {
        const enItems = listAllContent('en')
        expect(enItems.every((i) => i.lang === 'en')).toBe(true)

        // Spanish-AR will mix lang values via fallback chain (es-ar → es-419 → en)
        const esItems = listAllContent('es-ar')
        const langs = new Set(esItems.map((i) => i.lang))
        // At minimum, en is in the chain so it should appear; more locales may too.
        expect(langs.size).toBeGreaterThan(0)
        for (const lang of langs) {
            expect(['en', 'es-419', 'es-ar']).toContain(lang)
        }
    })

    it('excludes the legacy stories/index slug', () => {
        const items = listAllContent('en')
        expect(items.some((i) => i.type === 'stories' && i.slug === 'index')).toBe(false)
    })

    it('sorts blog items by date descending and emits them first', () => {
        const items = listAllContent('en')
        const blogItems = items.filter((i) => i.type === 'blog')
        const firstNonBlogIdx = items.findIndex((i) => i.type !== 'blog')
        if (firstNonBlogIdx !== -1) {
            expect(items.slice(0, firstNonBlogIdx).every((i) => i.type === 'blog')).toBe(true)
        }
        for (let i = 1; i < blogItems.length; i++) {
            const prev = new Date(blogItems[i - 1].date ?? 0).getTime()
            const curr = new Date(blogItems[i].date ?? 0).getTime()
            expect(prev).toBeGreaterThanOrEqual(curr)
        }
    })
})
