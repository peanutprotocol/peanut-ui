import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import SplitLandingPlaceholder from '@/app/[locale]/(marketing)/split/page'
import SplitNamespacePlaceholder, {
    generateStaticParams as generateNamespaceStaticParams,
} from '@/app/[locale]/(marketing)/split/[...path]/page'
import SplitGuidePage, {
    generateMetadata,
    generateStaticParams,
} from '@/app/[locale]/(marketing)/split/guides/[slug]/page'
import { BASE_URL } from '@/constants/general.consts'
import type { MarkdownContent } from '@/lib/content'
import {
    getAvailableSplitGuideLocales,
    getSplitGuideStaticParams,
    readPublishedSplitGuide,
    type SplitGuideFrontmatter,
} from '@/lib/split-guides'

jest.mock('next/navigation', () => ({
    notFound: jest.fn(() => {
        throw new Error('NEXT_NOT_FOUND')
    }),
}))

jest.mock('@/lib/mdx', () => {
    const React = jest.requireActual<typeof import('react')>('react')
    return {
        renderContent: jest.fn(async () => ({
            content: React.createElement('section', null, React.createElement('h2', null, 'Guide body')),
        })),
    }
})

jest.mock('@/lib/split-guides', () => {
    const actual = jest.requireActual<typeof import('@/lib/split-guides')>('@/lib/split-guides')
    return {
        ...actual,
        getAvailableSplitGuideLocales: jest.fn(),
        getSplitGuideStaticParams: jest.fn(),
        readPublishedSplitGuide: jest.fn(),
    }
})

const SLUG = 'split-a-group-trip-across-countries'
const guide: MarkdownContent<SplitGuideFrontmatter> = {
    frontmatter: {
        title: 'How to Split a Group Trip Across Countries',
        description: 'A precise guide to recording shared travel expenses across several countries and currencies.',
        date: '2026-07-28',
        author: 'Peanut',
        published: true,
    },
    body: '## Guide body',
}

const mockedNotFound = jest.mocked(notFound)
const mockedAvailableLocales = jest.mocked(getAvailableSplitGuideLocales)
const mockedStaticParams = jest.mocked(getSplitGuideStaticParams)
const mockedReadGuide = jest.mocked(readPublishedSplitGuide)

describe('Split route ownership and guide rendering', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockedAvailableLocales.mockReturnValue(['en', 'es-419', 'pt-br'])
        mockedStaticParams.mockReturnValue([
            { locale: 'en', slug: SLUG },
            { locale: 'es-419', slug: SLUG },
            { locale: 'pt-br', slug: SLUG },
        ])
        mockedReadGuide.mockReturnValue(guide)
    })

    it('reserves the bare and unknown localized Split namespace as intentional 404s', () => {
        expect(() => SplitLandingPlaceholder()).toThrow('NEXT_NOT_FOUND')
        expect(generateNamespaceStaticParams()).toEqual([])
        expect(() => SplitNamespacePlaceholder()).toThrow('NEXT_NOT_FOUND')
        expect(mockedNotFound).toHaveBeenCalledTimes(2)
    })

    it('passes through only the guide params selected by the exact-file helper', () => {
        expect(generateStaticParams()).toEqual([
            { locale: 'en', slug: SLUG },
            { locale: 'es-419', slug: SLUG },
            { locale: 'pt-br', slug: SLUG },
        ])
    })

    it('404s an exact supported locale when that locale file is missing', async () => {
        mockedReadGuide.mockReturnValue(null)

        await expect(SplitGuidePage({ params: Promise.resolve({ locale: 'es-ar', slug: SLUG }) })).rejects.toThrow(
            'NEXT_NOT_FOUND'
        )
        expect(mockedReadGuide).toHaveBeenCalledWith(SLUG, 'es-ar')
        expect(mockedNotFound).toHaveBeenCalledTimes(1)
    })

    it('renders one route-owned H1, one BlogPosting and no Article schema', async () => {
        const { container } = render(await SplitGuidePage({ params: Promise.resolve({ locale: 'en', slug: SLUG }) }))

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(guide.frontmatter.title)

        const schemas = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map(
            (script) => JSON.parse(script.textContent ?? '{}') as Record<string, unknown>
        )
        expect(schemas.filter((schema) => schema['@type'] === 'BlogPosting')).toHaveLength(1)
        expect(schemas.filter((schema) => schema['@type'] === 'BreadcrumbList')).toHaveLength(1)
        expect(schemas.filter((schema) => schema['@type'] === 'Article')).toHaveLength(0)
    })

    it('builds exact metadata from mocked content without absent locale signals', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'es-419', slug: SLUG }),
        })

        expect(metadata.title).toBe(`${guide.frontmatter.title} | Peanut`)
        expect(metadata.alternates).toMatchObject({
            canonical: `/es-419/split/guides/${SLUG}`,
            languages: {
                'x-default': `${BASE_URL}/en/split/guides/${SLUG}`,
                en: `${BASE_URL}/en/split/guides/${SLUG}`,
                'es-419': `${BASE_URL}/es-419/split/guides/${SLUG}`,
                'pt-BR': `${BASE_URL}/pt-br/split/guides/${SLUG}`,
            },
        })
        expect(metadata.alternates?.languages).not.toHaveProperty('es-AR')
        expect(metadata.openGraph).toMatchObject({
            locale: 'es_LA',
            alternateLocale: ['en_US', 'pt_BR'],
        })
        expect(metadata.openGraph).not.toMatchObject({ alternateLocale: expect.arrayContaining(['es_AR']) })
    })
})
