import { renderWithIntl } from '@/test-utils/intl'
import StoriesIndexPage from '@/app/[locale]/(marketing)/stories/page'
import { getTranslations } from '@/i18n'

// No story is English-only today, so serve one: `english-only` falls back to en, `nativa` is pt-br.
jest.mock('@/lib/content', () => ({
    listPublishedSlugs: () => ['english-only', 'nativa'],
    readPageContentLocalizedResolved: (_intent: string, slug: string) => ({
        lang: slug === 'english-only' ? 'en' : 'pt-br',
        content: { frontmatter: { title: `Title ${slug}`, description: `Description ${slug}` } },
    }),
}))
jest.mock('@/components/Marketing/ContentPage', () => ({
    ContentPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@/components/Marketing/mdx/Hero', () => ({ Hero: () => null }))

describe('stories hub English fallback label', () => {
    it('labels only the story the fallback serves in English', async () => {
        const page = await StoriesIndexPage({ params: Promise.resolve({ locale: 'pt-br' }) })
        const { container } = renderWithIntl(page)
        const label = getTranslations('pt-br').inEnglish
        const english = container.querySelector('a[href="/en/stories/english-only"]')!
        const native = container.querySelector('a[href="/pt-br/stories/nativa"]')!

        expect(english).toHaveTextContent(label)
        expect(english).toHaveAttribute('hrefLang', 'en')
        expect(english.querySelector('h3')).toHaveAttribute('lang', 'en')
        expect(native).not.toHaveTextContent(label)
        expect(native.querySelector('[lang]')).toBeNull()
    })
})
