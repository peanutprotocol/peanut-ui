import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { CORRIDORS, getCountryName } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readCorridorContentLocalized } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; from: string; to: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => CORRIDORS.map((c) => ({ locale, from: c.from, to: c.to })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, from, to } = await params
    if (!isValidLocale(locale)) return {}

    if (!CORRIDORS.some((c) => c.from === from && c.to === to)) return {}

    const mdxContent = readCorridorContentLocalized(to, from, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    const fm = mdxContent.frontmatter as { title?: string; description?: string }
    if (!fm.title || !fm.description) return {}

    return {
        ...metadataHelper({
            title: fm.title,
            description: fm.description,
            canonical: `/${locale}/send-money-from/${from}/to/${to}`,
        }),
        alternates: {
            canonical: `/${locale}/send-money-from/${from}/to/${to}`,
            languages: getAlternates('send-money-from', `${from}/to/${to}`),
        },
    }
}

export default async function FromToCorridorPage({ params }: PageProps) {
    const { locale, from, to } = await params
    if (!isValidLocale(locale)) notFound()
    if (!CORRIDORS.some((c) => c.from === from && c.to === to)) notFound()

    const mdxSource = readCorridorContentLocalized(to, from, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)
    const fromName = getCountryName(from, locale)
    const toName = getCountryName(to, locale)

    return (
        <ContentPage
            breadcrumbs={[
                { name: i18n.home, href: '/' },
                { name: `${fromName} → ${toName}`, href: `/${locale}/send-money-from/${from}/to/${to}` },
            ]}
        >
            {content}
        </ContentPage>
    )
}
