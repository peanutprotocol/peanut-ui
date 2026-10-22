import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentTopicHub } from '@/components/Marketing/ContentTopicHub'
import { isValidLocale, SUPPORTED_LOCALES } from '@/i18n/config'
import { contentTopicMetadata } from '@/lib/content-hub-metadata'
import { isContentTopic, listContentTopics } from '@/lib/content-topics'

interface PageProps {
    params: Promise<{ locale: string; topic: string }>
}

export function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => listContentTopics(locale).map((topic) => ({ locale, topic })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, topic } = await params
    if (!isValidLocale(locale) || !isContentTopic(topic) || !listContentTopics(locale).includes(topic)) return {}
    return contentTopicMetadata(locale, topic)
}

/**
 * Former address of a hub topic. The same page serves at /{locale}/blog/{topic}
 * (blog/[slug]/page.tsx), which is where canonical, hreflang and links point.
 */
export default async function ContentTopicPage({ params }: PageProps) {
    const { locale, topic } = await params
    if (!isValidLocale(locale) || !isContentTopic(topic) || !listContentTopics(locale).includes(topic)) notFound()
    return <ContentTopicHub locale={locale} topic={topic} />
}
