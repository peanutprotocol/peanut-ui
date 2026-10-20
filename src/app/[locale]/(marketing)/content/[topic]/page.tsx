import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { ContentGuideList } from '@/components/Marketing/ContentGuideList'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { getTranslations } from '@/i18n'
import { getAlternates, isValidLocale, SUPPORTED_LOCALES } from '@/i18n/config'
import { CONTENT_TOPICS, getContentTopicCopy } from '@/lib/content-topic-types'
import { isContentTopic, listContentTopic } from '@/lib/content-topics'

interface PageProps {
    params: Promise<{ locale: string; topic: string }>
}

export function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => CONTENT_TOPICS.map((topic) => ({ locale, topic })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, topic } = await params
    if (!isValidLocale(locale) || !isContentTopic(topic)) return {}
    const { title, description } = getContentTopicCopy(getTranslations(locale), topic)
    const canonical = `/${locale}/content/${topic}`

    return {
        ...metadataHelper({ locale, title: `${title} | Peanut`, description, canonical }),
        alternates: { canonical, languages: getAlternates('content', topic) },
    }
}

export default async function ContentTopicPage({ params }: PageProps) {
    const { locale, topic } = await params
    if (!isValidLocale(locale) || !isContentTopic(topic)) notFound()
    const i18n = getTranslations(locale)
    const { title, description } = getContentTopicCopy(i18n, topic)
    const items = listContentTopic(topic, locale)

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.content, href: `/${locale}/content` },
                { name: title, href: `/${locale}/content/${topic}` },
            ]}
        >
            <Hero title={title} subtitle={description} locale={locale} />
            <ContentGuideList items={items} locale={locale} heading={title} />
        </ContentPage>
    )
}
