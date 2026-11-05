import { renderWithIntl } from '@/test-utils/intl'
import { ContentGuideList } from '../ContentGuideList'
import { CONTENT_TOPICS, getContentTopicCopy } from '@/lib/content-topic-types'
import { listContentTopic, type ContentGuide } from '@/lib/content-topics'
import { getTranslations } from '@/i18n'
import type { Locale } from '@/i18n/types'

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
jest.mock('@/utils/native-help-context', () => ({ isNativeHelpContext: () => false }))

describe('topic guide links', () => {
    it.each(['en', 'es-419', 'es-ar', 'pt-br'] as Locale[])('renders ordinary links and topic copy in %s', (locale) => {
        const i18n = getTranslations(locale)
        const { container, getByRole } = renderWithIntl(
            <ContentGuideList
                locale={locale}
                heading={i18n.contentBrowseTopics}
                items={CONTENT_TOPICS.map((topic) => ({
                    ...getContentTopicCopy(i18n, topic),
                    href: `/${locale}/content/${topic}`,
                    lang: locale,
                }))}
            />
        )
        expect(getByRole('navigation', { name: i18n.contentBrowseTopics })).toBeInTheDocument()
        expect(container.querySelectorAll('a')).toHaveLength(6)
        expect(container.querySelector(`a[href="/${locale}/content/deposit"]`)).toHaveTextContent(
            getContentTopicCopy(i18n, 'deposit').title
        )
    })

    it('renders a retained USD guide and preserves an explicitly planned description', () => {
        const plannedGuide: ContentGuide = {
            href: '/en/pay-with/fixture-method',
            title: 'Fixture Method (Planned)',
            description: 'Fixture Method support in Peanut is planned.',
            lang: 'en',
        }
        const items = [...listContentTopic('deposit', 'en'), plannedGuide]
        const { container } = renderWithIntl(<ContentGuideList items={items} locale="en" />)
        expect(container.querySelector('a[href="/en/deposit/from-usd-account"]')).toHaveTextContent('USD')
        expect(container.querySelector('a[href="/en/pay-with/fixture-method"]')).toHaveTextContent(
            'support in Peanut is planned'
        )
    })

    it('marks English fallback copy without relabeling the target as translated', () => {
        const { container } = renderWithIntl(
            <ContentGuideList
                locale="pt-br"
                items={[
                    { href: '/en/deposit/from-test', title: 'Test guide', description: 'English prose', lang: 'en' },
                ]}
            />
        )
        const link = container.querySelector('a')!
        expect(link).toHaveAttribute('href', '/en/deposit/from-test')
        expect(link).toHaveAttribute('hrefLang', 'en')
        expect(link).toHaveTextContent('Em inglês')
    })
})
