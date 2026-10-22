import { getTranslations } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { contentHubPath } from '@/lib/content-hub-metadata'
import { type ContentTopic, getContentTopicCopy } from '@/lib/content-topic-types'
import { listContentTopic } from '@/lib/content-topics'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { ContentGuideList } from '@/components/Marketing/ContentGuideList'
import { Hero } from '@/components/Marketing/mdx/Hero'

/** One topic of the content hub, served at /{locale}/blog/{topic} and its /{locale}/content/{topic} alias. */
export function ContentTopicHub({ locale, topic }: { locale: Locale; topic: ContentTopic }) {
    const i18n = getTranslations(locale)
    const { title, description } = getContentTopicCopy(i18n, topic)
    const items = listContentTopic(topic, locale)

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.content, href: contentHubPath(locale) },
                { name: title, href: contentHubPath(locale, topic) },
            ]}
        >
            <Hero title={title} subtitle={description} locale={locale} />
            <ContentGuideList items={items} locale={locale} heading={title} />
        </ContentPage>
    )
}
