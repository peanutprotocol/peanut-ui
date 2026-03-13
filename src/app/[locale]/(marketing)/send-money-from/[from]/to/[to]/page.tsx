import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { CORRIDORS, getCountryName } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readCorridorContentLocalized, type ContentFrontmatter } from '@/lib/content'
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

    const mdxContent = readCorridorContentLocalized<ContentFrontmatter>(to, from, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    const { title, description } = mdxContent.frontmatter
    if (!title || !description) return {}

    return {
        ...metadataHelper({
            title,
            description,
            canonical: `/${locale}/send-money-from/${from}/to/${to}`,
            dynamicOg: true,
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

    const mdxSource = readCorridorContentLocalized<ContentFrontmatter>(to, from, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)
    const fromName = getCountryName(from, locale)
    const toName = getCountryName(to, locale)
    const url = `/${locale}/send-money-from/${from}/to/${to}`
    const fm = mdxSource.frontmatter

    return (
        <ContentPage
            breadcrumbs={[
                { name: i18n.home, href: '/' },
                { name: `${fromName} → ${toName}`, href: url },
            ]}
            article={
                fm.generated_at
                    ? { title: fm.title, description: fm.description, url, datePublished: fm.generated_at }
                    : undefined
            }
        >
            {content}
        </ContentPage>
    )
}
