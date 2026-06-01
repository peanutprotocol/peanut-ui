import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string }>
}

interface LegalFrontmatter {
    title: string
    description: string
    slug: string
    published?: boolean
    last_updated?: string
}

const SLUG = 'card-terms-international'

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}

    const mdxContent = readPageContentLocalized<LegalFrontmatter>('legal', SLUG, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    return {
        ...metadataHelper({
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${locale}/${SLUG}`,
        }),
        alternates: {
            canonical: `/${locale}/${SLUG}`,
            languages: getAlternates(SLUG),
        },
    }
}

export default async function CardTermsInternationalPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const mdxSource = readPageContentLocalized<LegalFrontmatter>('legal', SLUG, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)

    const displayTitle = mdxSource.frontmatter.title.replace(/\s*\|\s*Peanut$/, '')
    const url = `/${locale}/${SLUG}`

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: displayTitle, href: url },
            ]}
            article={
                mdxSource.frontmatter.last_updated
                    ? {
                          title: mdxSource.frontmatter.title,
                          description: mdxSource.frontmatter.description,
                          url,
                          datePublished: mdxSource.frontmatter.last_updated,
                      }
                    : undefined
            }
        >
            {content}
        </ContentPage>
    )
}
