import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { notFound } from 'next/navigation'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { readPageContentLocalized, listPublishedSlugs, type ContentFrontmatter } from '@/lib/content'
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
            const content = readPageContentLocalized<ContentFrontmatter>('stories', slug, locale)
            if (!content || content.frontmatter.published === false) return null
            return {
                slug,
                title: content.frontmatter.title,
                description: content.frontmatter.description,
            }
        })
        .filter(Boolean) as Array<{ slug: string; title: string; description: string }>

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.stories, href: `/${locale}/stories` },
            ]}
        >
            <Hero title={i18n.storiesTitle} subtitle={i18n.storiesSubtitle} />
            <div className="mx-auto mt-10 mb-8 max-w-[640px] px-6 md:mt-12 md:px-4">
                {stories.length === 0 ? (
                    <p className="text-center text-grey-1">{i18n.noStoriesPublished}</p>
                ) : (
                    <div className="flex flex-col gap-px overflow-hidden rounded-sm border border-n-1">
                        {stories.map((story) => (
                            <Link
                                key={story.slug}
                                href={`/${locale}/stories/${encodeURIComponent(story.slug)}`}
                                className="hover:bg-gray-50 flex flex-col gap-1.5 bg-white px-5 py-4 transition-colors"
                            >
                                <span className="text-sm font-medium text-n-1">{story.title}</span>
                                <span className="line-clamp-2 text-xs text-grey-1">{story.description}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </ContentPage>
    )
}
