import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { PAYMENT_METHODS, PAYMENT_METHOD_SLUGS } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; method: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => PAYMENT_METHOD_SLUGS.map((method) => ({ locale, method })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, method } = await params
    if (!isValidLocale(locale)) return {}

    const pm = PAYMENT_METHODS[method]
    if (!pm) return {}

    const mdxContent = readPageContentLocalized<{ title: string; description: string; published?: boolean }>(
        'pay-with',
        method,
        locale
    )
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    return {
        ...metadataHelper({
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${locale}/pay-with/${method}`,
        }),
        alternates: {
            canonical: `/${locale}/pay-with/${method}`,
            languages: getAlternates('pay-with', method),
        },
    }
}

export default async function PayWithPage({ params }: PageProps) {
    const { locale, method } = await params
    if (!isValidLocale(locale)) notFound()

    const pm = PAYMENT_METHODS[method]
    if (!pm) notFound()

    const mdxSource = readPageContentLocalized('pay-with', method, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)

    return (
        <ContentPage
            breadcrumbs={[
                { name: i18n.home, href: '/' },
                { name: pm.name, href: `/${locale}/pay-with/${method}` },
            ]}
        >
            {content}
        </ContentPage>
    )
}
