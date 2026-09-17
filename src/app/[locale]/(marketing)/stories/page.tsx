import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { notFound } from 'next/navigation'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { PROSE_WIDTH } from '@/components/Marketing/mdx/constants'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon } from '@/components/Global/Icons/Icon'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { readPageContentLocalizedResolved, listPublishedSlugs, type ContentFrontmatter } from '@/lib/content'
import Link from 'next/link'

interface PageProps {
    params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}

    return {
        ...metadataHelper({
            locale,
            title: `${getTranslations(locale).storiesTitle} | Peanut`,
            description: getTranslations(locale).storiesSubtitle,
            canonical: `/${locale}/stories`,
        }),
        alternates: {
            canonical: `/${locale}/stories`,
            languages: getAlternates('stories'),
        },
    }
}

export default async function StoriesIndexPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const i18n = getTranslations(locale)
    const slugs = listPublishedSlugs('stories')

    const stories = slugs
        .map((slug) => {
            if (slug === 'index') return null // legacy stories/index/ directory
            const resolved = readPageContentLocalizedResolved<ContentFrontmatter>('stories', slug, locale)
            if (!resolved || resolved.content.frontmatter.published === false) return null
            return {
                slug,
                // The serving locale owns the prose, so link it directly.
                href: `/${resolved.lang}/stories/${encodeURIComponent(slug)}`,
                title: resolved.content.frontmatter.title,
                description: resolved.content.frontmatter.description,
            }
        })
        .filter(Boolean) as Array<{ slug: string; href: string; title: string; description: string }>

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.stories, href: `/${locale}/stories` },
            ]}
        >
            <Hero title={i18n.storiesTitle} subtitle={i18n.storiesSubtitle} />
            <div className={`mx-auto mt-10 mb-8 ${PROSE_WIDTH} px-6 md:mt-12 md:px-4`}>
                {stories.length === 0 ? (
                    <EmptyState icon="docs" title={i18n.noStoriesPublished} />
                ) : (
                    <div className="flex flex-col">
                        {stories.map((story, index) => (
                            // ListItem owns no href, so the anchor wraps it: the row stays a
                            // real crawlable link and carries the DS focus ring.
                            <Link
                                key={story.slug}
                                href={story.href}
                                className="group block rounded-sm focus-visible:outline-[3px] focus-visible:outline-action-focus"
                            >
                                <ListItem
                                    position={getCardPosition(index, stories.length)}
                                    title={<h3 className="truncate group-hover:underline">{story.title}</h3>}
                                    body={story.description}
                                    trailing={
                                        <Icon name="arrow-up-right" size={20} className="text-foreground-secondary" />
                                    }
                                    className="transition-colors duration-instant group-hover:bg-background-disabled"
                                />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </ContentPage>
    )
}
