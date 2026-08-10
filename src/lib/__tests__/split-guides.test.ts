import { BASE_URL } from '@/constants/general.consts'
import { getAlternatesFor, type Locale } from '@/i18n/config'
import {
    buildSplitGuideBlogPosting,
    buildSplitGuideAlternates,
    buildSplitGuideMetadata,
    buildSplitGuideParams,
    buildSplitGuideSitemapRows,
    isPublishedSplitGuide,
    splitGuidePath,
    type SplitGuideFrontmatter,
} from '@/lib/split-guides'

const frontmatter: SplitGuideFrontmatter = {
    title: 'How to split a group trip',
    description: 'A practical guide to keeping a group trip fair.',
    date: '2026-07-28',
    published: true,
}

describe('split guide routing and SEO', () => {
    it('builds static params only for exact published locale files', () => {
        const slugs = ['group-trip', 'currencies']
        const locales: Locale[] = ['en', 'es-419', 'es-ar', 'pt-br']
        const exactFiles = new Set(['en/group-trip', 'es-419/group-trip', 'pt-br/group-trip', 'en/currencies'])

        expect(buildSplitGuideParams(slugs, locales, (slug, locale) => exactFiles.has(`${locale}/${slug}`))).toEqual([
            { locale: 'en', slug: 'group-trip' },
            { locale: 'en', slug: 'currencies' },
            { locale: 'es-419', slug: 'group-trip' },
            { locale: 'pt-br', slug: 'group-trip' },
        ])
    })

    it('does not let a valid translation seed routes when English is invalid', () => {
        const exactFiles = new Set(['es-419/orphaned-translation', 'pt-br/orphaned-translation'])

        expect(
            buildSplitGuideParams(['orphaned-translation'], ['en', 'es-419', 'pt-br'], (slug, locale) =>
                exactFiles.has(`${locale}/${slug}`)
            )
        ).toEqual([])
    })

    it('uses the clean split guide path', () => {
        expect(splitGuidePath('pt-br', 'group-trip')).toBe('/pt-br/split/guides/group-trip')
    })

    it('adds one Peanut suffix, a self-canonical and exact hreflang alternates', () => {
        const locales: Locale[] = ['en', 'es-419', 'pt-br']
        const metadata = buildSplitGuideMetadata(frontmatter, 'es-419', 'group-trip', locales)

        expect(metadata.title).toBe('How to split a group trip | Peanut')
        expect(metadata.alternates).toEqual({
            canonical: '/es-419/split/guides/group-trip',
            languages: getAlternatesFor(locales, 'split', 'guides', 'group-trip'),
        })
        expect(metadata.alternates?.languages).not.toHaveProperty('es-AR')
        expect(metadata.openGraph).toMatchObject({
            locale: 'es_LA',
            alternateLocale: ['en_US', 'pt_BR'],
        })
        expect(metadata.openGraph).not.toMatchObject({ alternateLocale: expect.arrayContaining(['es_AR']) })
    })

    it.each([
        { candidate: { ...frontmatter, title: 123 }, label: 'non-string title' },
        { candidate: { ...frontmatter, description: { text: 'oops' } }, label: 'non-string description' },
        { candidate: { ...frontmatter, date: '2026-02-30' }, label: 'invalid calendar date' },
        { candidate: { ...frontmatter, date: 'July 28, 2026' }, label: 'non-ISO date' },
        { candidate: { ...frontmatter, date: new Date(Number.NaN) }, label: 'non-finite Date' },
        { candidate: { ...frontmatter, published: 'true' }, label: 'non-boolean publication flag' },
        { candidate: { ...frontmatter, published: false }, label: 'unpublished guide' },
    ])('rejects malformed or unavailable frontmatter: $label', ({ candidate }) => {
        const content = { frontmatter: candidate, body: 'Guide body' }
        expect(() =>
            isPublishedSplitGuide(content as unknown as Parameters<typeof isPublishedSplitGuide>[0])
        ).not.toThrow()
        expect(isPublishedSplitGuide(content as unknown as Parameters<typeof isPublishedSplitGuide>[0])).toBe(false)
    })

    it('accepts a finite Date and normalizes it for schema output', () => {
        const content = {
            frontmatter: { ...frontmatter, date: new Date('2026-07-28T12:34:56.000Z') },
            body: 'Guide body',
        }
        expect(isPublishedSplitGuide(content)).toBe(true)
        expect(buildSplitGuideBlogPosting(content.frontmatter, 'en', 'group-trip')).toMatchObject({
            datePublished: '2026-07-28',
        })
    })

    it('builds the reciprocal exact-locale alternate set used by every sitemap row', () => {
        const languages = {
            'x-default': `${BASE_URL}/en/split/guides/group-trip`,
            en: `${BASE_URL}/en/split/guides/group-trip`,
            'es-419': `${BASE_URL}/es-419/split/guides/group-trip`,
            'pt-BR': `${BASE_URL}/pt-br/split/guides/group-trip`,
        }
        expect(buildSplitGuideAlternates('group-trip', ['en', 'es-419', 'pt-br'])).toEqual(languages)

        const rows = buildSplitGuideSitemapRows(
            [
                { locale: 'en', slug: 'group-trip' },
                { locale: 'es-419', slug: 'group-trip' },
                { locale: 'pt-br', slug: 'group-trip' },
            ],
            () => ['en', 'es-419', 'pt-br']
        )
        expect(rows.map((row) => row.path)).toEqual([
            '/en/split/guides/group-trip',
            '/es-419/split/guides/group-trip',
            '/pt-br/split/guides/group-trip',
        ])
        for (const row of rows) expect(row.alternates.languages).toEqual(languages)
    })

    it('emits one locale-specific BlogPosting payload', () => {
        expect(buildSplitGuideBlogPosting(frontmatter, 'pt-br', 'group-trip')).toMatchObject({
            '@type': 'BlogPosting',
            headline: frontmatter.title,
            datePublished: '2026-07-28',
            inLanguage: 'pt-BR',
            mainEntityOfPage: `${BASE_URL}/pt-br/split/guides/group-trip`,
        })
    })
})
