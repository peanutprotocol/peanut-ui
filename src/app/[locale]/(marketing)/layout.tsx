import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { isValidLocale } from '@/i18n/config'
import Footer from '@/components/LandingPage/Footer'
import { LocaleSwitcher } from '@/components/Marketing/LocaleSwitcher'
import { CrispLauncher } from '@/components/Marketing/CrispLauncher'
import { HeroBackNav } from '@/components/Marketing/HeroBackNav'
import { HtmlLang } from '@/components/Marketing/HtmlLang'
import { LocaleSuggestion } from '@/components/Marketing/LocaleSuggestion'
import { getTranslations } from '@/i18n'

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
        <main className="relative flex min-h-dvh flex-col bg-background-page" lang={locale}>
            <HtmlLang locale={locale} />
            <HeroBackNav />
            {/* THE marketing/content top bar (compare-page style, ruled the one
                header for all these pages): cream strip, HeroBackNav's circle
                floats over its left edge, flag selector flush right. px-4
                mirrors HeroBackNav's left-4; the inner h-10 row is the exact
                40px band the back circle occupies, so the selector centers on
                it (min-h on the padded div was border-box and did nothing). */}
            <div className="px-4 pt-[calc(var(--safe-top)_+_1rem)] pb-4">
                <div className="flex min-h-10 items-center justify-end">
                    {/* min-h, not h: the picker is a 44px touch target and a
                        fixed 40px row would clip it. The boundary stays because
                        anything here that reads search params bails the subtree
                        to client render, and without it every prerendered
                        marketing route fails the build. */}
                    <Suspense fallback={null}>
                        <LocaleSwitcher locale={locale} label={getTranslations(locale).footerLanguage} />
                    </Suspense>
                </div>
            </div>
            <LocaleSuggestion locale={locale} />
            <div className="flex-1">{children}</div>
            <Footer locale={locale} />
            {/* Crisp chat widget on all marketing/SEO pages. A component, not an
                inline script, because the launcher has to disappear again when a
                client-side navigation leaves marketing for the app — see
                utils/crisp-launcher. */}
            <CrispLauncher />
            {/* Intercept href="#chat" clicks to open Crisp (mousedown fires before navigation) */}
            <Script id="crisp-chat-links" strategy="lazyOnload">
                {`document.addEventListener("click",function(e){var a=e.target.closest('[href="#chat"]');if(a&&window.$crisp){e.preventDefault();e.stopPropagation();window.$crisp.push(["do","chat:show"]);window.$crisp.push(["do","chat:open"])}},true);`}
            </Script>
        </main>
    )
}
