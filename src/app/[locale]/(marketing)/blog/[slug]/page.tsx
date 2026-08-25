import { notFound } from 'next/navigation'
import Link from 'next/link'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { ArticleBackNav } from '@/components/Marketing/ArticleBackNav'
import { SUPPORTED_LOCALES, getAlternatesFor, isValidLocale } from '@/i18n/config'
import { availableContentLocales, contentLocaleFor } from '@/lib/content'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => {
        let posts = getAllPosts(locale as Locale)
        if (posts.length === 0) posts = getAllPosts('en')
        return posts.map((post) => ({ locale, slug: post.slug }))
    })
}

// Allow dynamic rendering for slugs not in static params (e.g. newly added content)
export const dynamicParams = true

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) return {}

    // A fallback-served page canonicalizes to the locale that owns the prose.
    const contentLocale = contentLocaleFor('blog', slug, locale) as Locale
    const post = await getPostBySlug(slug, contentLocale)
    if (!post) return {}

    return {
        ...metadataHelper({
            locale,
            title: `${post.frontmatter.title} | Peanut`,
            description: post.frontmatter.description,
            canonical: `/${contentLocale}/blog/${slug}`,
        }),
        alternates: {
            canonical: `/${contentLocale}/blog/${slug}`,
            languages: getAlternatesFor(availableContentLocales('blog', slug), 'blog', slug),
        },
    }
}

export default async function BlogPostPageLocalized({ params }: PageProps) {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) notFound()

    // Resolve through the full fallback chain (es-ar → es-419 → en), not
    // straight to English.
    const contentLocale = contentLocaleFor('blog', slug, locale) as Locale
    const post = await getPostBySlug(slug, contentLocale)
    if (!post) notFound()

    const i18n = getTranslations(locale)

    const blogPostSchema = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.frontmatter.title,
        description: post.frontmatter.description,
        datePublished: post.frontmatter.date,
        inLanguage: contentLocale,
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

    // The standalone /{locale}/blog index is gone (308 to the content hub), so the
    // parent crumb is the hub filtered to blog — same shape as compare/ and use-cases/.
    const hubHref = `/${locale}/content?type=blog`

    const breadcrumbs = [
        { name: i18n.home, href: `/${locale}` },
        { name: i18n.filterBlog, href: hubHref },
        { name: post.frontmatter.title, href: `/${locale}/blog/${slug}` },
    ]

    const localizedHrefs = Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `/${l}/blog/${slug}`])) as Record<
        Locale,
        string
    >

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
                <ArticleBackNav
                    parentLabel={i18n.filterBlog}
                    parentHref={hubHref}
                    backToTemplate={i18n.backTo}
                    currentLocale={locale as Locale}
                    localizedHrefs={localizedHrefs}
                />
                <nav aria-label="Breadcrumb" className="-mt-2 mb-4">
                    <ol className="flex flex-wrap items-center gap-1 text-xs text-grey-1">
                        {breadcrumbs.map((crumb, i) => (
                            <li key={crumb.href} className="flex items-center gap-1">
                                {i > 0 && <span aria-hidden>/</span>}
                                {i < breadcrumbs.length - 1 ? (
                                    <Link
                                        href={crumb.href}
                                        className="underline decoration-n-1/30 underline-offset-2 hover:text-n-1"
                                    >
                                        {crumb.name}
                                    </Link>
                                ) : (
                                    <span className="max-w-[200px] truncate font-medium text-n-1">{crumb.name}</span>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
                <header className="mb-8 border-b border-n-1 pb-6">
                    <h1 className="text-3xl font-bold md:text-4xl">{post.frontmatter.title}</h1>
                    <p className="mt-2">{post.frontmatter.description}</p>
                    <time className="mt-3 block text-sm">{post.frontmatter.date}</time>
                </header>
                <article className="prose prose-lg prose-headings:font-bold prose-a:text-black prose-a:underline prose-pre:border prose-pre:border-n-1 prose-pre:bg-white max-w-none">
                    {post.content}
                </article>
            </MarketingShell>
        </>
    )
}
