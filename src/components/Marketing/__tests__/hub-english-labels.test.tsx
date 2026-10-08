import { renderWithIntl } from '@/test-utils/intl'
import { ContentLinkList, type ContentLandingStrings } from '../ContentLanding'
import HelpLanding from '../HelpLanding'
import { getTranslations } from '@/i18n'
import { isEnglishFallback } from '@/i18n/englishFallback'
import { listAllContent, type ContentItem } from '@/lib/content'
import type { Locale } from '@/i18n/types'

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
jest.mock('@/utils/native-help-context', () => ({ isNativeHelpContext: () => false }))

function contentStrings(locale: Locale): ContentLandingStrings {
    const i18n = getTranslations(locale)
    return {
        searchPlaceholder: i18n.contentSearchPlaceholder,
        clearSearch: i18n.clearSearch,
        noResults: i18n.noContentResults,
        filterAll: i18n.filterAll,
        filterBlog: i18n.filterBlog,
        filterStories: i18n.filterStories,
        filterUseCases: i18n.filterUseCases,
        filterCompare: i18n.filterCompare,
        inEnglish: i18n.inEnglish,
    }
}

const item = (slug: string, lang: Locale): ContentItem => ({
    type: 'blog',
    slug,
    title: `Title ${slug}`,
    description: `Description ${slug}`,
    href: `/${lang}/blog/${slug}`,
    lang,
})

function renderHub(locale: Locale, items: ContentItem[]) {
    return renderWithIntl(<ContentLinkList items={items} locale={locale} strings={contentStrings(locale)} grouped />)
}

const rowFor = (container: HTMLElement, slug: string) =>
    container.querySelector<HTMLAnchorElement>(`a[href$="/blog/${slug}"]`)!

describe('isEnglishFallback', () => {
    it.each([
        ['en', 'pt-br', true],
        ['en', 'es-419', true],
        ['en', 'es-AR', true],
        ['es-419', 'es-ar', false],
        ['pt-br', 'pt-br', false],
        ['en', 'en', false],
    ])('served %s to a %s reader: %s', (served, reader, expected) => {
        expect(isEnglishFallback(served, reader)).toBe(expected)
    })
})

describe('content hub English fallback label', () => {
    it.each([
        ['pt-br', 'Em inglês'],
        ['es-419', 'En inglés'],
    ] as const)('labels an English item on the %s hub and tags it lang="en"', (locale, label) => {
        const { container } = renderHub(locale, [item('english-only', 'en')])
        const row = rowFor(container, 'english-only')

        expect(row).toHaveTextContent(label)
        expect(row).toHaveAttribute('hrefLang', 'en')
        // the owning locale's URL is kept — that is where the prose lives
        expect(row).toHaveAttribute('href', '/en/blog/english-only')
        expect(row.querySelector('h3')).toHaveAttribute('lang', 'en')
        expect(row.querySelector('[lang="en"]:not(h3)')).toHaveTextContent('Description english-only')
    })

    it('leaves es-419 items unlabelled on the es-ar hub', () => {
        const { container } = renderHub('es-ar', [item('latam', 'es-419')])
        const row = rowFor(container, 'latam')

        expect(row).not.toHaveTextContent(getTranslations('es-ar').inEnglish)
        expect(row).not.toHaveAttribute('hrefLang')
        expect(row.querySelector('[lang]')).toBeNull()
    })

    it('leaves same-locale items unlabelled', () => {
        const { container } = renderHub('pt-br', [item('nativo', 'pt-br')])
        const row = rowFor(container, 'nativo')

        expect(row).not.toHaveTextContent(getTranslations('pt-br').inEnglish)
        expect(row.querySelector('[lang]')).toBeNull()
    })

    it('labels the English-only Visa post on the real es-ar hub', () => {
        const { container } = renderHub('es-ar', listAllContent('es-ar'))
        const row = rowFor(container, 'stablecoin-balance-visa-merchants')

        expect(row).toHaveTextContent(getTranslations('es-ar').inEnglish)
        expect(row.querySelector('h3')).toHaveAttribute('lang', 'en')
    })
})

describe('help hub English fallback label', () => {
    const strings = {
        searchPlaceholder: 'Buscar',
        clearSearch: 'Limpar busca',
        noResults: 'Nada',
        cantFind: 'Não achou?',
        cantFindDesc: 'Fale com a gente.',
        inEnglish: getTranslations('pt-br').inEnglish,
    }

    it('labels only the article the fallback serves in English', () => {
        const { container } = renderWithIntl(
            <HelpLanding
                articles={[
                    {
                        slug: 'delete-account',
                        href: '/en/help/delete-account',
                        title: 'Delete your account',
                        description: 'How to delete',
                        category: 'Conta',
                        lang: 'en',
                    },
                    {
                        slug: 'passkeys',
                        href: '/pt-br/help/passkeys',
                        title: 'Passkeys',
                        description: 'Ajuda',
                        category: 'Conta',
                        lang: 'pt-br',
                    },
                ]}
                categories={['Conta']}
                locale="pt-br"
                strings={strings}
            />
        )
        const english = container.querySelector('a[href="/en/help/delete-account"]')!
        const native = container.querySelector('a[href="/pt-br/help/passkeys"]')!

        expect(english).toHaveTextContent('Em inglês')
        expect(english).toHaveAttribute('hrefLang', 'en')
        expect(english.querySelector('h3')).toHaveAttribute('lang', 'en')
        expect(native).not.toHaveTextContent('Em inglês')
        expect(native.querySelector('[lang]')).toBeNull()
    })
})
