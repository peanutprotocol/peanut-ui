import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { EXCHANGES, DEPOSIT_RAILS } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized, type ContentFrontmatter } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; exchange: string }>
}

export async function generateStaticParams() {
    const exchangeParams = Object.keys(EXCHANGES).map((e) => `from-${e}`)
    const railParams = Object.keys(DEPOSIT_RAILS).map((r) => `via-${r}`)
    const allSlugs = [...exchangeParams, ...railParams]
    return SUPPORTED_LOCALES.flatMap((locale) => allSlugs.map((exchange) => ({ locale, exchange })))
}
export const dynamicParams = false

/** Parse URL slug into { type, key }. Supports "from-binance" (exchange) and "via-sepa" (rail). */
function parseDepositSlug(raw: string): { type: 'exchange' | 'rail'; key: string } | null {
    if (raw.startsWith('from-')) return { type: 'exchange', key: raw.slice(5) }
    if (raw.startsWith('via-')) return { type: 'rail', key: raw.slice(4) }
    return null
}

/** Validate slug and return parsed info + display name, or null if invalid. */
function resolveDeposit(rawSlug: string): { type: 'exchange' | 'rail'; key: string; displayName: string } | null {
    const parsed = parseDepositSlug(rawSlug)
    if (!parsed) return null
    const { type, key } = parsed
    if (type === 'exchange') {
        const ex = EXCHANGES[key]
        return ex ? { type, key, displayName: ex.name } : null
    }
    const name = DEPOSIT_RAILS[key]
    return name ? { type, key, displayName: name } : null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, exchange: rawSlug } = await params
    if (!isValidLocale(locale)) return {}

    const deposit = resolveDeposit(rawSlug)
    if (!deposit) return {}

    const mdxContent = readPageContentLocalized<ContentFrontmatter>('deposit', deposit.key, locale)
    if (mdxContent && mdxContent.frontmatter.published !== false) {
        return {
            ...metadataHelper({
                title: mdxContent.frontmatter.title,
                description: mdxContent.frontmatter.description,
                canonical: `/${locale}/deposit/${rawSlug}`,
                dynamicOg: true,
            }),
            alternates: {
                canonical: `/${locale}/deposit/${rawSlug}`,
                languages: getAlternates('deposit', rawSlug),
            },
        }
    }

    // Fallback: i18n-based metadata (exchanges only — rails must have MDX)
    if (deposit.type === 'rail') return {}
    const ex = EXCHANGES[deposit.key]!
    const i18n = getTranslations(locale as Locale)

    return {
        ...metadataHelper({
            title: `${t(i18n.depositFrom, { exchange: ex.name })} | Peanut`,
            description: `${t(i18n.depositFrom, { exchange: ex.name })}. ${i18n.recommendedNetwork}: ${ex.recommendedNetwork}.`,
            canonical: `/${locale}/deposit/from-${deposit.key}`,
        }),
        alternates: {
            canonical: `/${locale}/deposit/from-${deposit.key}`,
            languages: getAlternates('deposit', `from-${deposit.key}`),
        },
    }
}

export default async function DepositPageLocalized({ params }: PageProps) {
    const { locale, exchange: rawSlug } = await params
    if (!isValidLocale(locale)) notFound()

    const deposit = resolveDeposit(rawSlug)
    if (!deposit) notFound()

    const mdxSource = readPageContentLocalized<ContentFrontmatter>('deposit', deposit.key, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)
    const url = `/${locale}/deposit/${rawSlug}`

    return (
        <ContentPage
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: deposit.displayName, href: url },
            ]}
            article={
                mdxSource.frontmatter.generated_at
                    ? {
                          title: mdxSource.frontmatter.title,
                          description: mdxSource.frontmatter.description,
                          url,
                          datePublished: mdxSource.frontmatter.generated_at,
                      }
                    : undefined
            }
        >
            {content}
        </ContentPage>
    )
}
