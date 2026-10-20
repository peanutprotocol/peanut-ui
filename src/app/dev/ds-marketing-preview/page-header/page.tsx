import { HeroBackNav } from '@/components/Marketing/HeroBackNav'
import { LocaleSwitcher } from '@/components/Marketing/LocaleSwitcher'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE } from '@/i18n/types'

/**
 * The marketing page header, composed from
 * the same parts as app/[locale]/(marketing)/layout.tsx: cream strip,
 * HeroBackNav's circle floating over its left edge, locale switcher flush
 * right. Every non-landing marketing page carries it; home and /lp keep the
 * bare hero. (The real strip pads by --safe-top; the browser value is 0, so
 * the demo uses the plain spacing step.)
 */
export default function PageHeaderPreview() {
    return (
        <main className="relative min-h-dvh bg-background-page">
            <HeroBackNav />
            <div className="px-4 pt-4 pb-4">
                <div className="flex min-h-10 items-center justify-end">
                    <LocaleSwitcher locale={DEFAULT_LOCALE} label={getTranslations(DEFAULT_LOCALE).footerLanguage} />
                </div>
            </div>
            <Hero title="A content page" subtitle="The strip rides above every non-landing hero" />
        </main>
    )
}
