import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Breadcrumb } from '@/components/0_Bruddle/Breadcrumb'
import { SUPPORTED_LOCALES, HREFLANG_MAP, isValidLocale } from '@/i18n/config'
import { getLocaleFallbacks, isPublished, readPageContent } from '@/lib/content'
import { BASE_URL } from '@/constants/general.consts'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
    // Include every post available through the locale's prose fallback, even
    // when the locale already has some translated posts.
    return SUPPORTED_LOCALES.flatMap((locale) => {
        const slugs = new Set(
            getLocaleFallbacks(locale).flatMap((lang) => getAllPosts(lang as Locale).map(({ slug }) => slug))
        )
        return [...slugs].map((slug) => ({ locale, slug }))
    })
}

// Allow dynamic rendering for slugs not in static params (e.g. newly added content)
export const dynamicParams = true

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) return {}

    // A fallback-served page canonicalizes to the locale that owns the prose.
    const post = await getPostBySlug(slug, locale)
    if (!post) return {}
    const contentLocale = post.locale

    const publishedLocales = SUPPORTED_LOCALES.filter((lang) => isPublished(readPageContent('blog', slug, lang)))
    const languages = Object.fromEntries(
        publishedLocales.map((lang) => [HREFLANG_MAP[lang], `${BASE_URL}/${lang}/blog/${slug}`])
    )

    return {
        ...metadataHelper({
            locale: contentLocale,
            title: `${post.frontmatter.title} | Peanut`,
            description: post.frontmatter.description,
            canonical: `/${contentLocale}/blog/${slug}`,
        }),
        alternates: {
            canonical: `/${contentLocale}/blog/${slug}`,
            languages: {
                ...languages,
                'x-default': `${BASE_URL}/${publishedLocales[0]}/blog/${slug}`,
            },
        },
    }
}

// An ISO date parses as UTC midnight, so format in UTC or a viewer west of
// Greenwich would see the day before. Unparseable dates show as authored.
function formatPostDate(date: string, locale: Locale): string {
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return date
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
        parsed
    )
}

export default async function BlogPostPageLocalized({ params }: PageProps) {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) notFound()

    // Resolve through the full fallback chain (es-ar → es-419 → en), not
    // straight to English.
    const post = await getPostBySlug(slug, locale)
    if (!post) notFound()
    const contentLocale = post.locale

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
        // the canonical URL: a fallback-served post canonicalizes to its content locale
        mainEntityOfPage: `https://peanut.me/${contentLocale}/blog/${slug}`,
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
            {/* The post title opens the page as the content hero band, like every
                other content page. The title is in the content
                locale; the Hero marks its own marquee with the route locale. */}
            <div lang={contentLocale}>
                <Hero title={post.frontmatter.title} locale={locale} />
            </div>
            {/* px-0: the mdx element map already carries the 24px prose inset
                (mx-auto PROSE_WIDTH px-6 md:px-4), so the shell's own padding
                would wrap the body in a second gutter (the old 40px column). */}
            <MarketingShell className="px-0 md:px-0">
                <header className="mx-6 mb-8 border-b border-border-default pb-6 md:mx-4">
                    <p className="text-body-l text-foreground-secondary">{post.frontmatter.description}</p>
                    <time dateTime={post.frontmatter.date} className="mt-3 block text-body-s text-foreground-secondary">
                        {formatPostDate(post.frontmatter.date, locale)}
                    </time>
                </header>
                {/* No `prose` wrapper: the body is compiled through createMdxComponents
                    like every other content route, and the element map already carries
                    the type tokens. The plugin classes only layered a second, divergent
                    set on top. */}
                <article lang={contentLocale}>{post.content}</article>
                {/* Foot of the page, not the top: the header already gives the way
                    back — same placement as every ContentPage route. */}
                <Breadcrumb items={breadcrumbs} label={i18n.breadcrumbLabel} className="px-6 pt-8 md:px-4" />
            </MarketingShell>
        </>
    )
}
