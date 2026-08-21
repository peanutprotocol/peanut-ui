import {
    contentGeneratedAt,
    listAllContent,
    readPageContent,
    resolveContentHref,
    type ContentFrontmatter,
} from '@/lib/content'

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

        // es-419 mixes lang values via the fallback chain (es-419 → en)
        const esItems = listAllContent('es-419')
        const langs = new Set(esItems.map((i) => i.lang))
        // At minimum, en is in the chain so it should appear; more locales may too.
        expect(langs.size).toBeGreaterThan(0)
        for (const lang of langs) {
            expect(['en', 'es-419']).toContain(lang)
        }
    })

    it('links fallback items to the locale that owns their prose', () => {
        const item = listAllContent('es-ar').find(
            ({ type, slug }) => type === 'blog' && slug === 'stablecoin-balance-visa-merchants'
        )

        expect(item).toMatchObject({
            lang: 'en',
            href: '/en/blog/stablecoin-balance-visa-merchants',
        })
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

describe('resolveContentHref', () => {
    it.each([
        ['/en/countries-do-not-exist', '/es-ar/countries-do-not-exist'],
        ['/en/poland', '/es-419/poland'],
        ['/en/send-money-to/australia', '/es-419/send-money-to/australia'],
        ['/en/send-money-from/colombia/to/argentina', '/es-419/send-money-from/colombia/to/argentina'],
        ['/en/receive-money-from/portugal', '/es-419/receive-money-from/portugal'],
        ['/en/compare/peanut-vs-wise', '/es-ar/compare/peanut-vs-wise'],
        ['/en/deposit/via-spei', '/es-419/deposit/via-spei'],
        ['/en/pay-with/mercadopago', '/es-ar/pay-with/mercadopago'],
        ['/en/help/passkeys', '/es-419/help/passkeys'],
        ['/en/use-cases/families', '/es-419/use-cases/families'],
        ['/en/stories/purple', '/es-419/stories/purple'],
        ['/en/withdraw/spei', '/es-419/withdraw/spei'],
        ['/en/blog/stablecoin-balance-visa-merchants', '/en/blog/stablecoin-balance-visa-merchants'],
        ['/en/card-terms-us', '/en/card-terms-us'],
        ['/en/pricing', '/es-419/pricing'],
        ['/en/press', '/en/press'],
    ])('points %s at its content owner', (href, expected) => {
        expect(resolveContentHref(href, 'es-ar')).toBe(expected)
    })

    it('preserves locale-native hubs and URL suffixes', () => {
        expect(resolveContentHref('/en/help?from=footer#payments', 'es-ar')).toBe('/es-ar/help?from=footer#payments')
        expect(resolveContentHref('/en/content#guides', 'es-ar')).toBe('/es-ar/content#guides')
        expect(resolveContentHref('/en/deposit/via-spei?from=footer#limits', 'es-ar')).toBe(
            '/es-419/deposit/via-spei?from=footer#limits'
        )
    })

    it.each(['https://peanut.me/en/help/passkeys', '//cdn.example.com/asset', 'mailto:hi@peanut.me', '#payments'])(
        'leaves external links and anchors unchanged: %s',
        (href) => {
            expect(resolveContentHref(href, 'es-ar')).toBe(href)
        }
    )
})

describe('contentGeneratedAt', () => {
    // gray-matter runs js-yaml, which turns unquoted YAML timestamps into Date objects even
    // though ContentFrontmatter types generated_at as a string — both shapes must work.
    it('accepts a Date (the usual runtime shape from unquoted YAML)', () => {
        const at = contentGeneratedAt({ frontmatter: { generated_at: new Date('2026-03-27') } as never, body: '' })
        expect(at?.toISOString().split('T')[0]).toBe('2026-03-27')
    })

    it('accepts a quoted string date', () => {
        const at = contentGeneratedAt({ frontmatter: { generated_at: '2026-03-20T17:10:00Z' } as never, body: '' })
        expect(at?.toISOString()).toBe('2026-03-20T17:10:00.000Z')
    })

    it('returns undefined for null content, a missing field, or an unparseable value', () => {
        expect(contentGeneratedAt(null)).toBeUndefined()
        expect(contentGeneratedAt({ frontmatter: {} as never, body: '' })).toBeUndefined()
        expect(contentGeneratedAt({ frontmatter: { generated_at: 'not-a-date' } as never, body: '' })).toBeUndefined()
        expect(contentGeneratedAt({ frontmatter: { generated_at: '' } as never, body: '' })).toBeUndefined()
    })

    it('reads a real date off a real content file', () => {
        const at = contentGeneratedAt(readPageContent<ContentFrontmatter>('help', 'delete-account', 'en'))
        expect(at).toBeInstanceOf(Date)
        // A real authored date, not the build clock.
        expect(at!.getTime()).toBeLessThan(Date.now())
        expect(at!.getUTCFullYear()).toBeGreaterThanOrEqual(2026)
    })
})
