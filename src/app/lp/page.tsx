/**
 * /lp route - Landing page that is ALWAYS accessible regardless of auth state.
 * This allows logged-in users to view the marketing landing page.
 * Uses Layout (client) instead of LandingPageShell since SSR doesn't matter here.
 * English-only alias of `/` — canonical points at `/` (see ./layout.tsx).
 */

import Layout from '@/components/Global/Layout'
import { LandingPageContent } from '@/components/LandingPage/LandingPageContent'
import { DEFAULT_LOCALE } from '@/i18n/types'

export default function LPPage() {
    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <LandingPageContent locale={DEFAULT_LOCALE} />
        </Layout>
    )
}
