import { notFound } from 'next/navigation'
import { isValidLocale, SUPPORTED_LOCALES } from '@/i18n/config'
import { MarketingNav } from '@/components/Marketing/MarketingNav'
import Footer from '@/components/LandingPage/Footer'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { HandThumbsUp } from '@/assets'

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
            <MarketingNav />
            <div className="flex-1">{children}</div>
            <MarqueeComp
                message={['Send money', 'Worldwide', 'No fees', 'Instant', 'Fiat / Crypto']}
                imageSrc={HandThumbsUp.src}
                backgroundColor="bg-primary-1"
            />
            <Footer />
        </main>
    )
}
