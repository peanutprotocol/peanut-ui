jest.mock('@/app/metadata', () => ({
    generateMetadata: (metadata: Record<string, unknown>) => metadata,
}))
jest.mock('@/data/seo', () => ({
    RECEIVE_SOURCES: ['india', 'france'],
    getCountryName: (country: string) => (country === 'india' ? 'India' : 'France'),
}))
jest.mock('@/i18n/config', () => ({
    SUPPORTED_LOCALES: ['en', 'pt-br'],
    isValidLocale: (locale: string) => ['en', 'pt-br'].includes(locale),
    getAlternatesFor: () => ({ en: '/en/receive-money-from/france' }),
}))
jest.mock('@/i18n', () => ({
    getTranslations: () => ({
        receiveMoneyFrom: 'Receive from {country}',
        receiveMoneyFromDesc: 'Options for {country}',
    }),
    t: (value: string, params: { country: string }) => value.replace('{country}', params.country),
}))
jest.mock('@/components/Marketing/ContentPage', () => ({ ContentPage: () => null }))
jest.mock('@/lib/mdx', () => ({ renderContent: jest.fn() }))
jest.mock('@/lib/content', () => ({
    readPageContentLocalized: jest.fn(),
    contentLocaleFor: jest.fn(() => 'en'),
    availableContentLocales: () => ['en'],
}))

import { generateMetadata } from '../page'
import { readPageContentLocalized, contentLocaleFor } from '@/lib/content'

const readContent = jest.mocked(readPageContentLocalized)
const params = (country = 'france', locale = 'en') => ({ params: Promise.resolve({ country, locale }) })

describe('receiving page metadata opt-in', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(contentLocaleFor).mockReturnValue('en')
    })

    it('keeps legacy claims out of metadata without explicit opt-in', async () => {
        readContent.mockReturnValue({
            frontmatter: { title: 'Instant and free', description: 'No verification needed' },
            body: '',
        })
        expect(await generateMetadata(params('india'))).toMatchObject({
            title: 'Receive from India | Peanut',
            description: 'Options for India',
        })
    })

    it('uses reviewed authored fields after opt-in', async () => {
        readContent.mockReturnValue({
            frontmatter: {
                use_content_metadata: true,
                title: 'Receive money from France | Peanut',
                description: 'Verified receiving options',
            },
            body: '',
        })
        expect(await generateMetadata(params())).toMatchObject({
            title: 'Receive money from France | Peanut',
            description: 'Verified receiving options',
        })
    })

    it.each([false, 'true', undefined])('requires a boolean true opt-in, received %s', async (flag) => {
        readContent.mockReturnValue({
            frontmatter: { use_content_metadata: flag, title: 'Legacy title', description: 'Legacy description' },
            body: '',
        })
        expect(await generateMetadata(params())).toMatchObject({
            title: 'Receive from France | Peanut',
            description: 'Options for France',
        })
    })

    it('falls back for blank or nontext authored fields and preserves the prose canonical', async () => {
        readContent.mockReturnValue({
            frontmatter: { use_content_metadata: true, title: ' ', description: 42 },
            body: '',
        })
        expect(await generateMetadata(params('france', 'pt-br'))).toMatchObject({
            title: 'Receive from France | Peanut',
            description: 'Options for France',
            canonical: '/en/receive-money-from/france',
            alternates: { canonical: '/en/receive-money-from/france' },
        })
    })

    it('does not expose unpublished metadata', async () => {
        readContent.mockReturnValue({
            frontmatter: { published: false, use_content_metadata: true, title: 'Draft' },
            body: '',
        })
        expect(await generateMetadata(params())).toEqual({})
    })
})
