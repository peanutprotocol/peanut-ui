import { render } from '@testing-library/react'
import CountryHubPage from '../page'
import { contentLocaleFor, readPageContentLocalized } from '@/lib/content'

jest.mock('@/constants/general.consts', () => ({ BASE_URL: 'https://peanut.me' }))
jest.mock('@/data/seo', () => ({ COUNTRIES_SEO: { argentina: {} }, getCountryName: () => 'Argentina' }))
jest.mock('@/lib/content', () => ({
    ...jest.requireActual('@/lib/content'),
    readPageContentLocalized: jest.fn(),
    contentLocaleFor: jest.fn(),
}))
jest.mock('@/lib/mdx', () => ({ renderContent: async () => ({ content: <p>Country prose</p> }) }))
jest.mock('@/lib/content-topics', () => ({ listCountryGuides: () => [] }))
jest.mock('@/components/Marketing/ContentGuideList', () => ({ ContentGuideList: () => null }))

function source(schema_types?: string[]) {
    jest.mocked(readPageContentLocalized).mockReturnValue({
        frontmatter: {
            title: 'Argentina guides',
            description: 'Guides for Argentina',
            schema_types,
            generated_at: '2026-10-22',
        },
        body: 'Country prose',
    })
}

const schemas = (container: HTMLElement) =>
    [...container.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.innerHTML))

it.each(['en', 'pt-br'])(
    'renders the declared collection using the prose locale and canonical on a %s route',
    async (locale) => {
        source(['BreadcrumbList', 'CollectionPage', 'FAQPage'])
        jest.mocked(contentLocaleFor).mockReturnValue('en')
        const { container } = render(
            await CountryHubPage({ params: Promise.resolve({ locale, country: 'argentina' }) })
        )
        const output = schemas(container)
        const collection = output.find((schema) => schema['@type'] === 'CollectionPage')

        expect(collection).toEqual({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Argentina guides',
            description: 'Guides for Argentina',
            url: 'https://peanut.me/en/argentina',
            inLanguage: 'en',
        })
        expect(output.some((schema) => schema['@type'] === 'Article')).toBe(false)
        expect(output.some((schema) => schema['@type'] === 'BreadcrumbList')).toBe(true)
        expect(container).toHaveTextContent('Country prose')
    }
)

it.each([undefined, ['BreadcrumbList', 'FAQPage']])(
    'does not invent a CollectionPage when the source does not declare it: %s',
    async (schema_types) => {
        source(schema_types)
        jest.mocked(contentLocaleFor).mockReturnValue('en')
        const { container } = render(
            await CountryHubPage({ params: Promise.resolve({ locale: 'en', country: 'argentina' }) })
        )
        expect(schemas(container).some((schema) => schema['@type'] === 'CollectionPage')).toBe(false)
    }
)
