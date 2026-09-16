import { notFound } from 'next/navigation'
import Script from 'next/script'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { isValidLocale } from '@/i18n/config'
import { CRISP_WEBSITE_ID } from '@/constants/crisp'
import Footer from '@/components/LandingPage/Footer'
import { ArticleLocaleNav } from '@/components/Marketing/ArticleLocaleNav'
import { HeroBackNav } from '@/components/Marketing/HeroBackNav'
import { HtmlLang } from '@/components/Marketing/HtmlLang'
import { LocaleSuggestion } from '@/components/Marketing/LocaleSuggestion'

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
        <main className="relative flex min-h-dvh flex-col bg-white" lang={locale}>
            <HtmlLang locale={locale} />
            <HeroBackNav />
            {/* THE marketing/content top bar (compare-page style, ruled the one
                header for all these pages): cream strip, HeroBackNav's circle
                floats over its left edge, flag selector flush right. px-4
                mirrors HeroBackNav's left-4; the inner h-10 row is the exact
                40px band the back circle occupies, so the selector centers on
                it (min-h on the padded div was border-box and did nothing). */}
            <div className="bg-background-page px-4 pt-[calc(var(--safe-top)_+_1rem)] pb-4">
                <div className="flex h-10 items-center justify-end">
                    <ArticleLocaleNav currentLocale={locale} />
                </div>
            </div>
            <LocaleSuggestion locale={locale} />
            <div className="flex-1">{children}</div>
            <Footer locale={locale} />
            {/* Crisp chat widget on all marketing/SEO pages */}
            <Script id="crisp-widget" strategy="lazyOnload">
                {`window.$crisp=[];window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";(function(){var d=document;var s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`}
            </Script>
            {/* Intercept href="#chat" clicks to open Crisp (mousedown fires before navigation) */}
            <Script id="crisp-chat-links" strategy="lazyOnload">
                {`document.addEventListener("click",function(e){var a=e.target.closest('[href="#chat"]');if(a&&window.$crisp){e.preventDefault();e.stopPropagation();window.$crisp.push(["do","chat:open"])}},true);`}
            </Script>
        </main>
    )
}
