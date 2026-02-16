import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { PAYMENT_METHODS, PAYMENT_METHOD_SLUGS } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t } from '@/i18n'
import { PayWithContent } from '@/components/Marketing/pages/PayWithContent'

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

    const i18n = getTranslations(locale as Locale)

    return {
        ...metadataHelper({
            title: `${t(i18n.payWith, { method: pm.name })} | Peanut`,
            description: t(i18n.payWithDesc, { method: pm.name }),
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

    return <PayWithContent method={method} locale={locale as Locale} />
}
