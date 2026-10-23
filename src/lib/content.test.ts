import fs from 'fs'
import {
    contentArticleMetadata,
    contentModifiedAt,
    contentPublishedAt,
    helpArticleTitle,
    listAllContent,
    listContentSlugs,
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
    beforeEach(() => {
        const exists = fs.existsSync
        const read = fs.readFileSync
        const fixture = (file: unknown) =>
            typeof file === 'string' &&
            [
                '/countries/poland/es-419.md',
                '/send-to/australia/es-419.md',
                '/send-to/argentina/from/colombia/es-419.md',
                '/receive-from/portugal/es-419.md',
                '/use-cases/families/es-419.md',
            ].some((suffix) => file.endsWith(suffix))
        jest.spyOn(fs, 'existsSync').mockImplementation((file) => fixture(file) || exists(file))
        jest.spyOn(fs, 'readFileSync').mockImplementation(((file: Parameters<typeof read>[0], options: unknown) =>
            fixture(file)
                ? '---\ntitle: Resolver fixture\npublished: true\n---\nExample'
                : read(file, options as never)) as typeof read)
    })
    afterEach(() => jest.restoreAllMocks())

    it('keeps locale-neutral app routes bare — /{locale}/card would 404 in the country catch-all', () => {
        expect(resolveContentHref('/card', 'es-ar')).toBe('/card')
        expect(resolveContentHref('/shhhhh?campaign=x', 'pt-br')).toBe('/shhhhh?campaign=x')
        expect(resolveContentHref('https://peanut.me/card', 'es-ar')).toBe('https://peanut.me/card')
        expect(resolveContentHref('https://peanut.me/en/card', 'es-ar')).toBe('https://peanut.me/card')
    })

    it.each([
        ['/en/countries-do-not-exist', '/es-ar/countries-do-not-exist'],
        ['/en/poland', '/es-419/poland'],
        ['/en/send-money-to/australia', '/es-419/send-money-to/australia'],
        ['/en/send-money-from/colombia/to/argentina', '/es-419/send-money-from/colombia/to/argentina'],
        ['/en/receive-money-from/portugal', '/es-419/deposit/from-eur-account'],
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

    it.each([
        ['/en/deposit/from-binance?from=guide#fees', 'en', '/en/help/deposit-crypto?from=guide#fees'],
        ['/en/deposit/from-binance?from=guide#fees', 'es-ar', '/es-419/help/deposit-crypto?from=guide#fees'],
        ['/en/receive-money-from/france#details', 'pt-br', '/pt-br/deposit/from-eur-account#details'],
        ['/en/withdraw/solana', 'es-ar', '/es-419/help/withdraw-crypto'],
    ] as const)('links %s directly to its localized replacement in %s', (href, locale, expected) => {
        expect(resolveContentHref(href, locale)).toBe(expected)
        expect(resolveContentHref(`https://peanut.me${href}`, locale)).toBe(`https://peanut.me${expected}`)
    })

    it('localizes en-authored absolute URLs without a content owner, like their relative form', () => {
        expect(resolveContentHref('https://peanut.me/en/help', 'es-ar')).toBe('https://peanut.me/es-ar/help')
        expect(resolveContentHref('https://peanut.me/en/content#guides', 'es-419')).toBe(
            'https://peanut.me/es-419/content#guides'
        )
    })

    it('resolves owners for percent-encoded content segments', () => {
        expect(resolveContentHref('/en/help/pass%6beys', 'es-ar')).toBe('/es-419/help/pass%6beys')
    })

    it('resolves exact production-origin content URLs while preserving their absolute form and suffix', () => {
        const fallbackUrl = 'https://peanut.me/es-419/card-terms-international?from=fees#terms'
        const ownerUrl = 'https://peanut.me/en/card-terms-international?from=fees#terms'

        expect(resolveContentHref(fallbackUrl, 'es-419')).toBe(ownerUrl)
        expect(resolveContentHref(ownerUrl, 'es-419')).toBe(ownerUrl)
        expect(resolveContentHref('https://peanut.me/en/help/passkeys', 'es-ar')).toBe(
            'https://peanut.me/es-419/help/passkeys'
        )
    })

    it.each([
        'https://peanut.me/shhhhh?from=content#card',
        'https://peanut.me/es-ar/help',
        'https://peanut.me.evil.com/es-419/terms',
        'https://peanut.me@evil.com/es-419/terms',
        'http://peanut.me/es-419/terms',
    ])('leaves non-content or non-exact production origins unchanged: %s', (href) => {
        expect(resolveContentHref(href, 'es-419')).toBe(href)
    })

    it.each(['//cdn.example.com/asset', 'mailto:hi@peanut.me', '#payments', 'https://example.com/en/help/passkeys'])(
        'leaves external links and anchors unchanged: %s',
        (href) => {
            expect(resolveContentHref(href, 'es-ar')).toBe(href)
        }
    )

    it.each([
        ['es-419', ['https://peanut.me/es-419/card-terms-international', 'https://peanut.me/es-419/terms']],
        ['pt-br', ['https://peanut.me/pt-br/card-terms-international', 'https://peanut.me/pt-br/terms']],
    ] as const)('repairs the fallback-only absolute legal links authored in fees-pricing/%s.md', (locale, urls) => {
        const content = readPageContent('help', 'fees-pricing', locale)
        expect(content).not.toBeNull()
        for (const url of urls) expect(content?.body).toContain(url)
        expect(urls.map((url) => resolveContentHref(url, locale))).toEqual([
            'https://peanut.me/en/card-terms-international',
            'https://peanut.me/en/terms',
        ])
    })
})

describe('source content dates', () => {
    const content = (dates: Partial<ContentFrontmatter>) => ({
        frontmatter: { title: 'Title', description: 'Description', ...dates },
        body: '',
    })

    it('keeps authored publication and modification dates separate from regeneration', () => {
        const source = content({
            date: new Date('2026-03-20'),
            last_updated: '2026-04-15',
            generated_at: '2026-10-22',
        })
        expect(contentPublishedAt(source)?.toISOString()).toBe('2026-03-20T00:00:00.000Z')
        expect(contentModifiedAt(source)?.toISOString()).toBe('2026-04-15T00:00:00.000Z')
    })

    it('uses an explicit publication date before the blog date', () => {
        const source = content({ published_at: '2026-03-21', date: '2026-03-20' })
        expect(contentPublishedAt(source)?.toISOString()).toBe('2026-03-21T00:00:00.000Z')
        expect(contentModifiedAt(source)).toEqual(contentPublishedAt(source))
    })

    it('never treats last_updated as a publication date', () => {
        const source = content({ last_updated: new Date('2026-10-14') })
        expect(contentPublishedAt(source)).toBeUndefined()
        expect(contentModifiedAt(source)?.toISOString()).toBe('2026-10-14T00:00:00.000Z')
    })

    it.each([
        null,
        content({}),
        content({ generated_at: '2026-10-22' }),
        content({ date: 'invalid', last_updated: new Date('invalid'), published_at: '' }),
    ])('omits dates when the source has no valid publication or modification date', (source) => {
        expect(contentPublishedAt(source)).toBeUndefined()
        expect(contentModifiedAt(source)).toBeUndefined()
    })

    it('reads the authored date from an actual blog and omits a generated-only help date', () => {
        const blog = readPageContent<ContentFrontmatter>('blog', 'stablecoin-balance-visa-merchants', 'en')
        expect(contentPublishedAt(blog)?.toISOString()).toBe('2026-05-21T00:00:00.000Z')
        expect(contentModifiedAt(readPageContent<ContentFrontmatter>('help', 'delete-account', 'en'))).toBeUndefined()
    })

    it.each([undefined, ['BreadcrumbList', 'FAQPage'], ['WebPage'], ['CollectionPage']])(
        'does not turn a non-article schema declaration into Article: %s',
        (schema_types) => {
            expect(
                contentArticleMetadata(content({ schema_types, generated_at: '2026-10-22' }), '/en/help/test')
            ).toBeUndefined()
        }
    )

    it('preserves a declared Article without inventing dates', () => {
        expect(
            contentArticleMetadata(
                content({ schema_types: ['Article'], generated_at: '2026-10-22' }),
                '/en/stories/test'
            )
        ).toEqual({
            title: 'Title',
            description: 'Description',
            url: '/en/stories/test',
            schemaType: 'Article',
            datePublished: undefined,
            dateModified: undefined,
        })
    })

    it('uses BlogPosting when declared and supplies separate source dates', () => {
        expect(
            contentArticleMetadata(
                content({
                    schema_types: ['Article', 'BlogPosting'],
                    date: '2026-03-20',
                    last_updated: '2026-04-15',
                    generated_at: '2026-10-22',
                }),
                '/en/blog/test'
            )
        ).toMatchObject({
            schemaType: 'BlogPosting',
            datePublished: '2026-03-20T00:00:00.000Z',
            dateModified: '2026-04-15T00:00:00.000Z',
        })
    })
})

describe('helpArticleTitle', () => {
    it.each([
        ['Peanut Transaction Limits | Peanut Help', 'Peanut Transaction Limits'],
        ['Límites de transacciones | Ayuda Peanut', 'Límites de transacciones'],
        ['Limites de transações | Ajuda Peanut', 'Limites de transações'],
        ['Reportar un Error o Falla de Seguridad | Peanut', 'Reportar un Error o Falla de Seguridad'],
        ['A title with no suffix', 'A title with no suffix'],
    ])('%s → %s', (title, expected) => {
        expect(helpArticleTitle(title)).toBe(expected)
    })

    it('leaves no site suffix on any help article in any locale', () => {
        for (const slug of listContentSlugs('help')) {
            for (const locale of ['en', 'es-419', 'es-ar', 'pt-br']) {
                const page = readPageContent<{ title?: string }>('help', slug, locale)
                if (!page?.frontmatter.title) continue
                const title = helpArticleTitle(page.frontmatter.title)
                expect(title).not.toContain('|')
                expect(title.length).toBeGreaterThan(0)
            }
        }
    })
})
