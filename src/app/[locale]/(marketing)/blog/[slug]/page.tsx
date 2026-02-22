import { notFound } from 'next/navigation'
import Link from 'next/link'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'

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

    const i18n = getTranslations(locale)

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

    // FAQ schema from frontmatter (optional)
    const faqs = post.frontmatter.faqs
    const faqSchema = faqs?.length
        ? {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((faq) => ({
                  '@type': 'Question',
                  name: faq.question,
                  acceptedAnswer: { '@type': 'Answer', text: faq.answer },
              })),
          }
        : null

    const breadcrumbs = [
        { name: i18n.home, href: '/' },
        { name: i18n.blog, href: `/${locale}/blog` },
        { name: post.frontmatter.title, href: `/${locale}/blog/${slug}` },
    ]

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: crumb.name,
            item: crumb.href.startsWith('http') ? crumb.href : `https://peanut.me${crumb.href}`,
        })),
    }

    return (
        <>
            <JsonLd data={blogPostSchema} />
            <JsonLd data={breadcrumbSchema} />
            {faqSchema && <JsonLd data={faqSchema} />}
            <MarketingShell className="max-w-2xl">
                <nav aria-label="Breadcrumb" className="mb-4 -mt-2">
                    <ol className="flex flex-wrap items-center gap-1 text-xs text-grey-1">
                        {breadcrumbs.map((crumb, i) => (
                            <li key={crumb.href} className="flex items-center gap-1">
                                {i > 0 && <span aria-hidden>/</span>}
                                {i < breadcrumbs.length - 1 ? (
                                    <Link href={crumb.href} className="underline decoration-n-1/30 underline-offset-2 hover:text-n-1">
                                        {crumb.name}
                                    </Link>
                                ) : (
                                    <span className="text-n-1 font-medium truncate max-w-[200px]">{crumb.name}</span>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
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
