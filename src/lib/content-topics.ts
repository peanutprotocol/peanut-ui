import { COUNTRIES_SEO, CORRIDORS, RECEIVE_SOURCES, SEND_TO_COUNTRIES } from '@/data/seo/corridors'
import { DEPOSIT_RAILS } from '@/data/seo/deposit-rails'
import { EXCHANGES } from '@/data/seo/exchanges'
import { PAYMENT_METHOD_SLUGS } from '@/data/seo/payment-methods'
import { isGoneMarketingPath } from '@/constants/gone-routes.consts'
import type { Locale } from '@/i18n/types'
import {
    getLocaleFallbacks,
    isPublished,
    listPublishedSlugs,
    readCorridorContent,
    readPageContentLocalizedResolved,
    type ContentFrontmatter,
} from './content'
import { CONTENT_TOPICS, type ContentTopic } from './content-topic-types'

export interface ContentGuide {
    href: string
    title: string
    description: string
    lang: Locale
}

export function isContentTopic(value: string): value is ContentTopic {
    return CONTENT_TOPICS.some((topic) => topic === value)
}

function pageGuide(intent: string, slug: string, route: string, locale: Locale): ContentGuide | null {
    const resolved = readPageContentLocalizedResolved<ContentFrontmatter>(intent, slug, locale)
    if (!resolved) return null
    const href = `/${resolved.lang}/${route}`
    if (isGoneMarketingPath(href)) return null
    return { ...resolved.content.frontmatter, href, lang: resolved.lang as Locale }
}

function corridorGuide(from: string, to: string, locale: Locale): ContentGuide | null {
    // The corridor route uses the first existing file, even if it is unpublished.
    // Match that boundary so the directory never points at a notFound response.
    for (const lang of getLocaleFallbacks(locale)) {
        const content = readCorridorContent<ContentFrontmatter>(to, from, lang)
        if (!content) continue
        const href = `/${lang}/send-money-from/${from}/to/${to}`
        if (!isPublished(content) || isGoneMarketingPath(href)) return null
        return { ...content.frontmatter, href, lang: lang as Locale }
    }
    return null
}

function sortedGuides(items: Array<ContentGuide | null>, locale: Locale): ContentGuide[] {
    return items
        .filter((item): item is ContentGuide => item !== null)
        .sort((a, b) => a.title.localeCompare(b.title, locale))
}

/** Use the same registries as the routes, then resolve each published file's language. */
export function listContentTopic(topic: ContentTopic, locale: Locale): ContentGuide[] {
    switch (topic) {
        case 'countries':
            return sortedGuides(
                Object.keys(COUNTRIES_SEO).map((slug) => pageGuide('countries', slug, slug, locale)),
                locale
            )
        case 'deposit':
            return sortedGuides(
                [
                    ...Object.keys(EXCHANGES).map((slug) => pageGuide('deposit', slug, `deposit/from-${slug}`, locale)),
                    ...Object.keys(DEPOSIT_RAILS).map((slug) =>
                        pageGuide('deposit', slug, `deposit/via-${slug}`, locale)
                    ),
                ],
                locale
            )
        case 'receive':
            return sortedGuides(
                RECEIVE_SOURCES.map((slug) => pageGuide('receive-from', slug, `receive-money-from/${slug}`, locale)),
                locale
            )
        case 'send':
            return sortedGuides(
                [
                    ...SEND_TO_COUNTRIES.map((slug) => pageGuide('send-to', slug, `send-money-to/${slug}`, locale)),
                    ...CORRIDORS.map(({ from, to }) => corridorGuide(from, to, locale)),
                ],
                locale
            )
        case 'pay':
            return sortedGuides(
                PAYMENT_METHOD_SLUGS.map((slug) => pageGuide('pay-with', slug, `pay-with/${slug}`, locale)),
                locale
            )
        case 'withdraw':
            return sortedGuides(
                listPublishedSlugs('withdraw').map((slug) => pageGuide('withdraw', slug, `withdraw/${slug}`, locale)),
                locale
            )
    }
}

/** Empty directories do not get an indexable topic page or navigation link. */
export function listContentTopics(locale: Locale): ContentTopic[] {
    return CONTENT_TOPICS.filter((topic) => listContentTopic(topic, locale).length > 0)
}

/** Country pages connect to their own receiving guide and the corridors that include them. */
export function listCountryGuides(country: string, locale: Locale): ContentGuide[] {
    return sortedGuides(
        [
            RECEIVE_SOURCES.includes(country)
                ? pageGuide('receive-from', country, `receive-money-from/${country}`, locale)
                : null,
            SEND_TO_COUNTRIES.includes(country)
                ? pageGuide('send-to', country, `send-money-to/${country}`, locale)
                : null,
            ...CORRIDORS.filter(({ from, to }) => from === country || to === country).map(({ from, to }) =>
                corridorGuide(from, to, locale)
            ),
        ],
        locale
    )
}
