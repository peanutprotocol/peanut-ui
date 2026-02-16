import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getAllCategories, getPostsByCategory } from '@/lib/blog'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { BlogCard } from '@/components/Marketing/BlogCard'
import Link from 'next/link'
import { SUPPORTED_LOCALES, isValidLocale, getAlternates } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'

interface PageProps {
    params: Promise<{ locale: string; cat: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => {
        // Use English categories as fallback
        const cats = getAllCategories(locale as Locale)
        const fallbackCats = cats.length > 0 ? cats : getAllCategories('en')
        return fallbackCats.map((cat) => ({ locale, cat }))
    })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, cat } = await params
    if (!isValidLocale(locale)) return {}

    const label = cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    return {
        ...metadataHelper({
            title: `${label} — Blog | Peanut`,
            description: label,
            canonical: `/${locale}/blog/category/${cat}`,
        }),
        alternates: {
            canonical: `/${locale}/blog/category/${cat}`,
            languages: getAlternates('blog', `category/${cat}`),
        },
    }
}

export default async function BlogCategoryPageLocalized({ params }: PageProps) {
    const { locale, cat } = await params
    if (!isValidLocale(locale)) notFound()

    const typedLocale = locale as Locale
    const i18n = getTranslations(typedLocale)

    let posts = getPostsByCategory(cat, typedLocale)
    if (posts.length === 0) posts = getPostsByCategory(cat, 'en')
    if (posts.length === 0) notFound()

    const label = cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const categories = getAllCategories(typedLocale).length > 0 ? getAllCategories(typedLocale) : getAllCategories('en')

    return (
        <>
            <MarketingHero title={label} subtitle={i18n.allArticles} ctaText="" />
            <MarketingShell>
                <div className="mb-8 flex flex-wrap gap-2">
                    <Link
                        href={`/${locale}/blog`}
                        className="rounded-sm border border-n-1 px-3 py-1 text-sm hover:bg-primary-3/30"
                    >
                        {i18n.allArticles}
                    </Link>
                    {categories.map((c) => (
                        <Link
                            key={c}
                            href={`/${locale}/blog/category/${c}`}
                            className={`rounded-sm border border-n-1 px-3 py-1 text-sm ${
                                c === cat ? 'bg-primary-1/20 font-semibold' : 'hover:bg-primary-3/30'
                            }`}
                        >
                            {c}
                        </Link>
                    ))}
                </div>

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
            </MarketingShell>
        </>
    )
}
