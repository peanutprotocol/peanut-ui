import { notFound } from 'next/navigation'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { isValidLocale } from '@/i18n/config'
import Footer from '@/components/LandingPage/Footer'

interface LayoutProps {
    children: React.ReactNode
    params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

export default async function LocalizedMarketingLayout({ children, params }: LayoutProps) {
    const { locale } = await params

    if (!isValidLocale(locale)) {
        notFound()
    }

    return (
        <main className="flex min-h-dvh flex-col bg-white" lang={locale}>
            <div className="flex-1">{children}</div>
            <Footer />
        </main>
    )
}
