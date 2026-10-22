import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getTranslations } from '@/i18n'
import { getAlternates } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { type ContentTopic, getContentTopicCopy } from '@/lib/content-topic-types'

/**
 * The content hub's canonical home is /{locale}/blog. /{locale}/content serves
 * the same pages, so both routes build their links, canonical and hreflang
 * from here and nothing points a crawler at the alias.
 */
export function contentHubPath(locale: Locale, topic?: ContentTopic): string {
    return topic ? `/${locale}/blog/${topic}` : `/${locale}/blog`
}

export function contentHubMetadata(locale: Locale): Metadata {
    const i18n = getTranslations(locale)
    const canonical = contentHubPath(locale)
    return {
        ...metadataHelper({
            locale,
            title: `${i18n.contentHubTitle} | Peanut`,
            description: i18n.contentHubSubtitle,
            canonical,
        }),
        alternates: { canonical, languages: getAlternates('blog') },
    }
}

export function contentTopicMetadata(locale: Locale, topic: ContentTopic): Metadata {
    const { title, description } = getContentTopicCopy(getTranslations(locale), topic)
    const canonical = contentHubPath(locale, topic)
    return {
        ...metadataHelper({ locale, title: `${title} | Peanut`, description, canonical }),
        alternates: { canonical, languages: getAlternates('blog', topic) },
    }
}
