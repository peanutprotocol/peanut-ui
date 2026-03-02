import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized, listContentSlugs } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

interface HelpFrontmatter {
    title: string
    description: string
    slug: string
    category?: string
    published?: boolean
}

const HELP_SLUGS = listContentSlugs('help')

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => HELP_SLUGS.map((slug) => ({ locale, slug })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) return {}

    const mdxContent = readPageContentLocalized<HelpFrontmatter>('help', slug, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    return {
        ...metadataHelper({
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${locale}/help/${slug}`,
        }),
        alternates: {
            canonical: `/${locale}/help/${slug}`,
            languages: getAlternates('help', slug),
        },
    }
}

export default async function HelpArticlePage({ params }: PageProps) {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) notFound()

    const mdxSource = readPageContentLocalized<HelpFrontmatter>('help', slug, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)

    const displayTitle = mdxSource.frontmatter.title.replace(/\s*\|\s*Peanut Help$/, '')

    return (
        <ContentPage
            breadcrumbs={[
                { name: i18n.home, href: '/' },
                { name: i18n.help, href: `/${locale}/help` },
                { name: displayTitle, href: `/${locale}/help/${slug}` },
            ]}
        >
            {content}
        </ContentPage>
    )
}
