import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, isValidLocale } from '@/i18n/config'
import { readPageContentLocalized, listContentSlugs } from '@/lib/content'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { BASE_URL } from '@/constants/general.consts'
import HelpLanding from '@/components/Marketing/HelpLanding'

interface PageProps {
    params: Promise<{ locale: string }>
}

interface HelpFrontmatter {
    title: string
    description: string
    slug: string
    category?: string
    published?: boolean
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}

    return metadataHelper({
        title: 'Help Center | Peanut',
        description:
            'Get help with Peanut — verification, passkeys, payments, deposits, and account recovery. Step-by-step guides and answers to common questions.',
        canonical: `/${locale}/help`,
    })
}

export default async function HelpPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const slugs = listContentSlugs('help')
    const articles = slugs
        .map((slug) => {
            const content = readPageContentLocalized<HelpFrontmatter>('help', slug, locale)
            if (!content || content.frontmatter.published === false) return null
            return {
                slug,
                title: content.frontmatter.title.replace(/\s*\|\s*Peanut Help$/, ''),
                description: content.frontmatter.description,
                category: content.frontmatter.category ?? 'General',
            }
        })
        .filter(Boolean) as Array<{ slug: string; title: string; description: string; category: string }>

    // Group by category for display order
    const categories = [...new Set(articles.map((a) => a.category))]

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
            { '@type': 'ListItem', position: 2, name: 'Help', item: `${BASE_URL}/${locale}/help` },
        ],
    }

    return (
        <>
            <JsonLd data={breadcrumbSchema} />
            <HelpLanding articles={articles} categories={categories} locale={locale} />
        </>
    )
}
