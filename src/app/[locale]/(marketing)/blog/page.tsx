import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getAllPosts, getAllCategories } from '@/lib/blog'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { BlogCard } from '@/components/Marketing/BlogCard'
import Link from 'next/link'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'

interface PageProps {
    params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}

    const i18n = getTranslations(locale as Locale)

    return {
        ...metadataHelper({
            title: `${i18n.blog} | Peanut`,
            description: i18n.allArticles,
            canonical: `/${locale}/blog`,
        }),
        alternates: {
            canonical: `/${locale}/blog`,
            languages: getAlternates('blog'),
        },
    }
}

export default async function BlogIndexPageLocalized({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const typedLocale = locale as Locale
    const i18n = getTranslations(typedLocale)

    // Try locale-specific posts first, fall back to English
    let posts = getAllPosts(typedLocale)
    if (posts.length === 0) posts = getAllPosts('en')

    const categories = getAllCategories(typedLocale)

    return (
        <>
            <MarketingHero title={i18n.blog} subtitle={i18n.allArticles} ctaText="" />
            <MarketingShell>
                {categories.length > 0 && (
                    <div className="mb-8 flex flex-wrap gap-2">
                        <Link
                            href={`/${locale}/blog`}
                            className="rounded-sm border border-n-1 bg-primary-1/20 px-3 py-1 text-sm font-semibold"
                        >
                            {i18n.allArticles}
                        </Link>
                        {categories.map((cat) => (
                            <Link
                                key={cat}
                                href={`/${locale}/blog/category/${cat}`}
                                className="rounded-sm border border-n-1 px-3 py-1 text-sm hover:bg-primary-3/30"
                            >
                                {cat}
                            </Link>
                        ))}
                    </div>
                )}

                {posts.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {posts.map((post) => (
                            <BlogCard
                                key={post.slug}
                                slug={post.slug}
                                title={post.frontmatter.title}
                                excerpt={post.frontmatter.description}
                                date={post.frontmatter.date}
                                category={post.frontmatter.category}
                                hrefPrefix={`/${locale}/blog`}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="py-12 text-center text-gray-500">Blog posts coming soon.</p>
                )}
            </MarketingShell>
        </>
    )
}
