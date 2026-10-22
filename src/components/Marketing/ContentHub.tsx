import { Suspense } from 'react'
import { getTranslations } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { listAllContent } from '@/lib/content'
import { contentHubPath } from '@/lib/content-hub-metadata'
import { getContentTopicCopy } from '@/lib/content-topic-types'
import { listContentTopics } from '@/lib/content-topics'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { ContentGuideList } from '@/components/Marketing/ContentGuideList'
import { ContentHubFallback } from '@/components/Marketing/ContentHubFallback'
import ContentLanding, { type ContentLandingStrings } from '@/components/Marketing/ContentLanding'
import { Hero } from '@/components/Marketing/mdx/Hero'

/** The content hub body, served at /{locale}/blog and its /{locale}/content alias. */
export function ContentHub({ locale }: { locale: Locale }) {
    const i18n = getTranslations(locale)
    const items = listAllContent(locale)

    const strings: ContentLandingStrings = {
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

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.content, href: contentHubPath(locale) },
            ]}
        >
            <Hero title={i18n.contentHubTitle} subtitle={i18n.contentHubSubtitle} locale={locale} />
            <ContentGuideList
                locale={locale}
                heading={i18n.contentBrowseTopics}
                items={listContentTopics(locale).map((topic) => ({
                    ...getContentTopicCopy(i18n, topic),
                    href: contentHubPath(locale, topic),
                    lang: locale,
                }))}
            />
            <Suspense fallback={<ContentHubFallback items={items} locale={locale} strings={strings} />}>
                <ContentLanding items={items} locale={locale} strings={strings} />
            </Suspense>
        </ContentPage>
    )
}
