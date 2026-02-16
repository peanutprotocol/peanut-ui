import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
    // Generate params for locales that have blog content (fall back to en slugs)
    return SUPPORTED_LOCALES.flatMap((locale) => {
        let posts = getAllPosts(locale as Locale)
        if (posts.length === 0) posts = getAllPosts('en')
        return posts.map((post) => ({ locale, slug: post.slug }))
    })
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) return {}

    // Try locale-specific post first, fall back to English
    const post = (await getPostBySlug(slug, locale as Locale)) ?? (await getPostBySlug(slug, 'en'))
    if (!post) return {}

    return {
        ...metadataHelper({
            title: `${post.frontmatter.title} | Peanut`,
            description: post.frontmatter.description,
            canonical: `/${locale}/blog/${slug}`,
        }),
        alternates: {
            canonical: `/${locale}/blog/${slug}`,
            languages: getAlternates('blog', slug),
        },
    }
}

export default async function BlogPostPageLocalized({ params }: PageProps) {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) notFound()

    const post = (await getPostBySlug(slug, locale as Locale)) ?? (await getPostBySlug(slug, 'en'))
    if (!post) notFound()

    const blogPostSchema = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.frontmatter.title,
        description: post.frontmatter.description,
        datePublished: post.frontmatter.date,
        inLanguage: locale,
        author: { '@type': 'Organization', name: post.frontmatter.author ?? 'Peanut' },
        publisher: { '@type': 'Organization', name: 'Peanut', url: 'https://peanut.me' },
        mainEntityOfPage: `https://peanut.me/${locale}/blog/${slug}`,
    }

    return (
        <>
            <JsonLd data={blogPostSchema} />
            <MarketingShell className="max-w-2xl">
                <header className="mb-8 border-b border-n-1 pb-6">
                    {post.frontmatter.category && (
                        <span className="mb-2 inline-block rounded-sm bg-primary-1/20 px-2 py-0.5 text-xs font-semibold">
                            {post.frontmatter.category}
                        </span>
                    )}
                    <h1 className="text-3xl font-bold md:text-4xl">{post.frontmatter.title}</h1>
                    <p className="mt-2 text-gray-600">{post.frontmatter.description}</p>
                    <time className="mt-3 block text-sm text-gray-400">{post.frontmatter.date}</time>
                </header>
                <article
                    className="prose prose-lg prose-headings:font-bold prose-a:text-black prose-a:underline prose-pre:border prose-pre:border-n-1 prose-pre:bg-white max-w-none"
                    dangerouslySetInnerHTML={{ __html: post.html }}
                />
            </MarketingShell>
        </>
    )
}
