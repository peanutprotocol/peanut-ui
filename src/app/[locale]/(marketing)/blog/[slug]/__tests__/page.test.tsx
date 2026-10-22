import fs from 'fs'
import { render } from '@testing-library/react'
import BlogPostPage, { generateMetadata, generateStaticParams } from '../page'
import * as blog from '@/lib/blog'
import { SUPPORTED_LOCALES } from '@/i18n/types'

jest.mock('@/lib/mdx', () => ({
    renderContent: async (body: string) => ({ content: body }),
}))
jest.mock('@/constants/general.consts', () => ({ BASE_URL: 'https://peanut.me' }))
jest.mock('@/components/Marketing/MarketingShell', () => ({
    MarketingShell: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/components/Marketing/mdx/Hero', () => ({ Hero: () => null }))
jest.mock('@/components/Marketing/JsonLd', () => ({ JsonLd: () => null }))
jest.mock('@/components/0_Bruddle/Breadcrumb', () => ({ Breadcrumb: () => null }))
jest.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error('NEXT_NOT_FOUND')
    },
}))

const ENGLISH_ONLY_SLUG = 'stablecoin-balance-visa-merchants'
const params = (locale: string, slug = ENGLISH_ONLY_SLUG) => ({ params: Promise.resolve({ locale, slug }) })

afterEach(() => jest.restoreAllMocks())

it('generates the English-only article in every locale even when translated posts already exist', async () => {
    expect(blog.getAllPosts('es-ar').length).toBeGreaterThan(0)
    expect(blog.getAllPosts('es-ar').some(({ slug }) => slug === ENGLISH_ONLY_SLUG)).toBe(false)
    const generated = await generateStaticParams()

    for (const locale of SUPPORTED_LOCALES) {
        expect(generated.filter((entry) => entry.locale === locale && entry.slug === ENGLISH_ONLY_SLUG)).toEqual([
            { locale, slug: ENGLISH_ONLY_SLUG },
        ])
    }
    expect(new Set(generated.map(({ locale, slug }) => `${locale}/${slug}`)).size).toBe(generated.length)
})

it.each(['es-419', 'es-ar', 'pt-br'])(
    'serves the English prose and canonical without advertising a nonexistent %s translation',
    async (locale) => {
        const metadata = await generateMetadata(params(locale))
        expect(metadata.alternates).toEqual({
            canonical: `/en/blog/${ENGLISH_ONLY_SLUG}`,
            languages: {
                'x-default': `https://peanut.me/en/blog/${ENGLISH_ONLY_SLUG}`,
                en: `https://peanut.me/en/blog/${ENGLISH_ONLY_SLUG}`,
            },
        })
        const { container } = render(await BlogPostPage(params(locale)))
        expect(container.querySelector('article')).toHaveAttribute('lang', 'en')
        expect(container).toHaveTextContent('What is the Peanut Card?')
    }
)

it('keeps locale-only published posts available through their actual fallback chain', async () => {
    jest.spyOn(blog, 'getAllPosts').mockImplementation((locale) =>
        locale === 'es-419'
            ? [
                  {
                      slug: 'spanish-only',
                      frontmatter: { title: 'Spanish article', description: 'Article', date: '2026-10-22' },
                      content: 'Article',
                  },
              ]
            : []
    )
    expect(await generateStaticParams()).toEqual([
        { locale: 'es-419', slug: 'spanish-only' },
        { locale: 'es-ar', slug: 'spanish-only' },
    ])
})

it('does not generate or serve unpublished blog prose', async () => {
    const read = fs.readFileSync
    jest.spyOn(fs, 'readFileSync').mockImplementation(((file: Parameters<typeof read>[0], options: unknown) => {
        const value = read(file, options as never)
        return typeof file === 'string' &&
            file.endsWith(`/blog/${ENGLISH_ONLY_SLUG}/en.md`) &&
            typeof value === 'string'
            ? value.replace(/^---/, '---\npublished: false')
            : value
    }) as typeof read)

    expect((await generateStaticParams()).some(({ slug }) => slug === ENGLISH_ONLY_SLUG)).toBe(false)
    expect(await generateMetadata(params('es-ar'))).toEqual({})
    await expect(BlogPostPage(params('es-ar'))).rejects.toThrow('NEXT_NOT_FOUND')
})

it('does not expose a draft translation through an expanded fallback route', async () => {
    const slug = 'earn-with-peanut-3min-setup'
    const read = fs.readFileSync
    jest.spyOn(fs, 'readFileSync').mockImplementation(((file: Parameters<typeof read>[0], options: unknown) => {
        const value = read(file, options as never)
        return typeof file === 'string' && file.endsWith(`/blog/${slug}/es-ar.md`) && typeof value === 'string'
            ? value.replace(/^---/, '---\npublished: false')
            : value
    }) as typeof read)

    expect(blog.getAllPosts('es-ar').some((post) => post.slug === slug)).toBe(false)
    expect(await generateStaticParams()).toContainEqual({ locale: 'es-ar', slug })
    expect(await generateMetadata(params('es-ar', slug))).toEqual({})
    await expect(BlogPostPage(params('es-ar', slug))).rejects.toThrow('NEXT_NOT_FOUND')
})
