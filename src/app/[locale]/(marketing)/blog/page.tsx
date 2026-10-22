import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentHub } from '@/components/Marketing/ContentHub'
import { SUPPORTED_LOCALES, isValidLocale } from '@/i18n/config'
import { contentHubMetadata } from '@/lib/content-hub-metadata'

interface PageProps {
    params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}
    return contentHubMetadata(locale)
}

/** The content hub. /{locale}/content serves the same page (content/page.tsx re-exports this one). */
export default async function ContentHubPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()
    return <ContentHub locale={locale} />
}
