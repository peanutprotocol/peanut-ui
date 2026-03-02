import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { COMPETITORS } from '@/data/seo'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Section } from '@/components/Marketing/Section'
import { ComparisonTable } from '@/components/Marketing/ComparisonTable'
import { FAQSection } from '@/components/Marketing/FAQSection'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t, localizedPath } from '@/i18n'
import { RelatedPages } from '@/components/Marketing/RelatedPages'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
    const slugs = Object.keys(COMPETITORS)
    return SUPPORTED_LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug: `peanut-vs-${slug}` })))
}
export const dynamicParams = false

/** Strip the "peanut-vs-" URL prefix to get the data key. Returns null if prefix missing. */
function parseSlug(raw: string): string | null {
    if (!raw.startsWith('peanut-vs-')) return null
    return raw.slice('peanut-vs-'.length)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug: rawSlug } = await params
    if (!isValidLocale(locale)) return {}

    const slug = parseSlug(rawSlug)
    if (!slug) return {}
    const competitor = COMPETITORS[slug]
    if (!competitor) return {}

    // Try MDX content frontmatter first
    const mdxContent = readPageContentLocalized<{ title: string; description: string; published?: boolean }>(
        'compare',
        slug,
        locale
    )
    if (mdxContent && mdxContent.frontmatter.published !== false) {
        return {
            ...metadataHelper({
                title: mdxContent.frontmatter.title,
                description: mdxContent.frontmatter.description,
                canonical: `/${locale}/compare/peanut-vs-${slug}`,
            }),
            alternates: {
                canonical: `/${locale}/compare/peanut-vs-${slug}`,
                languages: getAlternates('compare', `peanut-vs-${slug}`),
            },
        }
    }

    // Fallback: i18n-based metadata
    const year = new Date().getFullYear()

    return {
        ...metadataHelper({
            title: `Peanut vs ${competitor.name} ${year} | Peanut`,
            description: `Peanut vs ${competitor.name}: ${competitor.tagline}`,
            canonical: `/${locale}/compare/peanut-vs-${slug}`,
        }),
        alternates: {
            canonical: `/${locale}/compare/peanut-vs-${slug}`,
            languages: getAlternates('compare', `peanut-vs-${slug}`),
        },
    }
}

export default async function ComparisonPageLocalized({ params }: PageProps) {
    const { locale, slug: rawSlug } = await params
    if (!isValidLocale(locale)) notFound()

    const slug = parseSlug(rawSlug)
    if (!slug) notFound()
    const competitor = COMPETITORS[slug]
    if (!competitor) notFound()

    // Try MDX content first
    const mdxSource = readPageContentLocalized('compare', slug, locale)
    if (mdxSource && mdxSource.frontmatter.published !== false) {
        const { content } = await renderContent(mdxSource.body)
        const i18n = getTranslations(locale)
        return (
            <ContentPage
                breadcrumbs={[
                    { name: i18n.home, href: '/' },
                    { name: `Peanut vs ${competitor.name}`, href: `/${locale}/compare/peanut-vs-${slug}` },
                ]}
            >
                {content}
            </ContentPage>
        )
    }

    // Fallback: old React-driven page
    const i18n = getTranslations(locale as Locale)
    const year = new Date().getFullYear()

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: i18n.home, item: 'https://peanut.me' },
            {
                '@type': 'ListItem',
                position: 2,
                name: `Peanut vs ${competitor.name}`,
                item: `https://peanut.me/${locale}/compare/peanut-vs-${slug}`,
            },
        ],
    }

    return (
        <>
            <JsonLd data={breadcrumbSchema} />

            <MarketingHero
                title={`Peanut vs ${competitor.name} [${year}]`}
                subtitle={`${competitor.tagline} — ${year}`}
                image={competitor.image}
            />

            <MarketingShell>
                <Section title={i18n.feature}>
                    <ComparisonTable competitorName={competitor.name} rows={competitor.rows} />
                </Section>

                <Section title={i18n.verdict}>
                    <p className="text-gray-700">{competitor.verdict}</p>
                </Section>

                <FAQSection faqs={competitor.faqs} />

                {/* Related comparisons */}
                <RelatedPages
                    title={i18n.relatedPages}
                    pages={Object.entries(COMPETITORS)
                        .filter(([s]) => s !== slug)
                        .slice(0, 5)
                        .map(([s, c]) => ({
                            title: `Peanut vs ${c.name} [${year}]`,
                            href: localizedPath('compare', locale, `peanut-vs-${s}`),
                        }))}
                />

                {/* Last updated */}
                <p className="py-4 text-xs text-gray-400">
                    {t(i18n.lastUpdated, { date: new Date().toISOString().split('T')[0] })}
                </p>
            </MarketingShell>
        </>
    )
}
