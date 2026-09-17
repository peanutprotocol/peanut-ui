import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Breadcrumb } from '@/components/0_Bruddle/Breadcrumb'
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
            {/* No width prop: MarketingShell never merged its className, so blog has
                always rendered at the shell's own width. Passing max-w-2xl now that
                the merge works would silently narrow every post. */}
            <MarketingShell>
                <header className="mb-8 border-b border-border-default pb-6">
                    <h1 className="text-heading-m md:text-heading-l">{post.frontmatter.title}</h1>
                    <p className="mt-2 text-body-l text-foreground-secondary">{post.frontmatter.description}</p>
                    <time className="mt-3 block text-body-s text-foreground-secondary">{post.frontmatter.date}</time>
                </header>
                {/* No `prose` wrapper: the body is compiled through createMdxComponents
                    like every other content route, and the element map already carries
                    the type tokens. The plugin classes only layered a second, divergent
                    set on top. */}
                <article>{post.content}</article>
                {/* Foot of the page, not the top: the header already gives the way
                    back — same placement as every ContentPage route. */}
                <Breadcrumb items={breadcrumbs} className="pt-8" />
            </MarketingShell>
        </>
    )
}
