import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { EXCHANGES } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized, type ContentFrontmatter } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; exchange: string }>
}

export async function generateStaticParams() {
    const exchanges = Object.keys(EXCHANGES)
    return SUPPORTED_LOCALES.flatMap((locale) =>
        exchanges.map((exchange) => ({ locale, exchange: `from-${exchange}` }))
    )
}
export const dynamicParams = false

/** Strip the "from-" URL prefix to get the data key. Returns null if prefix missing. */
function parseExchange(raw: string): string | null {
    if (!raw.startsWith('from-')) return null
    return raw.slice('from-'.length)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, exchange: rawExchange } = await params
    if (!isValidLocale(locale)) return {}

    const exchange = parseExchange(rawExchange)
    if (!exchange) return {}
    const ex = EXCHANGES[exchange]
    if (!ex) return {}

    const mdxContent = readPageContentLocalized<ContentFrontmatter>('deposit', exchange, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    return {
        ...metadataHelper({
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${locale}/deposit/from-${exchange}`,
            dynamicOg: true,
        }),
        alternates: {
            canonical: `/${locale}/deposit/from-${exchange}`,
            languages: getAlternates('deposit', `from-${exchange}`),
        },
    }
}

export default async function DepositPageLocalized({ params }: PageProps) {
    const { locale, exchange: rawExchange } = await params
    if (!isValidLocale(locale)) notFound()

    const exchange = parseExchange(rawExchange)
    if (!exchange) notFound()
    const ex = EXCHANGES[exchange]
    if (!ex) notFound()

    const mdxSource = readPageContentLocalized<ContentFrontmatter>('deposit', exchange, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)
    const url = `/${locale}/deposit/from-${exchange}`

    return (
        <ContentPage
            breadcrumbs={[
                { name: i18n.home, href: '/' },
                { name: ex.name, href: url },
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
