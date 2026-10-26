import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import Footer from '@/components/LandingPage/Footer'
import { AppModalProvider } from '@/components/Migration/AppModalProvider'
import { starLpKnerdFilled, starLpKnerdOutline } from './starLpFonts'
import type { StarLpPageProps } from './starLp.types'

/**
 * Page shell for a star LP: the landing shell, the app-download modal context
 * the CTAs need, the footer. Story beats render complete on the server (see
 * useStoryStep), so no-JS visitors need no extra style. The Knerd variables
 * point at the preloaded faces (starLpFonts).
 */
export function StarLpPage({ children, siteDirectory = true, localeSwitcher = true, marketingPage }: StarLpPageProps) {
    return (
        <LandingPageShell>
            <AppModalProvider marketingPage={marketingPage} marketingLocale="en">
                <main className={`${starLpKnerdOutline.variable} ${starLpKnerdFilled.variable} bg-background-page`}>
                    {children}
                </main>
            </AppModalProvider>
            <Footer showSiteDirectory={siteDirectory} showLocaleSwitcher={localeSwitcher} />
        </LandingPageShell>
    )
}
